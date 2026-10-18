/**
 * Local source-checkout inspection.
 *
 * `resolve()` is the synchronous, cached slice the prompt provider reads on
 * every assembly: only a directory and the checkout marker are checked.
 * `inspect()` is the richer asynchronous view shown on the configuration page;
 * it also reads git status and the exact tag at HEAD. Neither function throws
 * for an invalid configured path; the route returns the structured result.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { SourceInspection } from './shared.ts'
import type { GitResult, GitRunner } from './git.ts'
import { capOutput } from './git.ts'

/** Marker every DSH source checkout carries. */
export const CHECKOUT_MARKER = 'packages/client/tsdown.client.ts'

/** How long a successful/failed synchronous resolution is reused. */
export const RESOLVE_TTL_MS = 5000

/** Result of the lightweight synchronous resolution. */
export interface ResolvedSource {
  /** Absolute checkout path. */
  path: string
  /** `package.json` version when readable. */
  version?: string
}

/** Parsed `git status --porcelain=v2 --branch` facts. */
export interface GitStatusSummary {
  /** Current branch; undefined for a detached HEAD. */
  branch?: string
  /** Upstream ref such as `origin/master`. */
  upstream?: string
  /** Commits ahead of upstream. */
  ahead?: number
  /** Commits behind upstream. */
  behind?: number
  /** Whether HEAD is detached. */
  detached?: boolean
  /** Whether any path has an uncommitted change. */
  dirty: boolean
  /** Short HEAD object id. */
  head?: string
}

/** Dependencies of {@link SourceResolver}; injected for tests. */
export interface SourceResolverDeps {
  /** Read the current configured path (volatile config getter). */
  readPath: () => string
  /** Git executor; only `inspect()` uses it. */
  git: GitRunner
  /** Clock injection for cache tests. */
  now?: () => number
}

/**
 * Parse `git status --porcelain=v2 --branch` output.
 * @param text - stdout of the git command.
 * @returns branch/upstream/ahead/behind/dirty/head facts; empty output means a
 *   clean working tree with no branch headers.
 */
export function parseGitStatusV2(text: string): GitStatusSummary {
  const summary: GitStatusSummary = { dirty: false }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/u, '')
    if (line === '') continue
    if (!line.startsWith('#')) {
      summary.dirty = true
      continue
    }
    if (line.startsWith('# branch.oid ')) {
      const oid = line.slice('# branch.oid '.length).trim()
      if (oid !== '' && oid !== '(initial)') summary.head = oid.slice(0, 8)
      continue
    }
    if (line.startsWith('# branch.head ')) {
      const name = line.slice('# branch.head '.length).trim()
      if (name === '(detached)') summary.detached = true
      else if (name !== '') summary.branch = name
      continue
    }
    if (line.startsWith('# branch.upstream ')) {
      const name = line.slice('# branch.upstream '.length).trim()
      if (name !== '') summary.upstream = name
      continue
    }
    if (line.startsWith('# branch.ab ')) {
      const match = /\+(\d+)\s+-(\d+)/u.exec(line)
      if (match !== null) {
        summary.ahead = Number(match[1])
        summary.behind = Number(match[2])
      }
    }
  }
  return summary
}

/**
 * Parse `git describe --tags --exact-match HEAD` output.
 * @param text - stdout of the command.
 * @returns the exact tag, or undefined when HEAD has none.
 */
export function parseDescribeTag(text: string): string | undefined {
  const tag = text.split('\n').map(line => line.trim()).find(line => line !== '')
  return tag
}

function readVersionSync(path: string): string | undefined {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'))
    if (typeof manifest !== 'object' || manifest === null) return undefined
    const version = (manifest as Record<string, unknown>)['version']
    return typeof version === 'string' && version !== '' ? version : undefined
  } catch {
    return undefined
  }
}

async function readVersion(path: string): Promise<string | undefined> {
  try {
    const manifest: unknown = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'))
    if (typeof manifest !== 'object' || manifest === null) return undefined
    const version = (manifest as Record<string, unknown>)['version']
    return typeof version === 'string' && version !== '' ? version : undefined
  } catch {
    return undefined
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Inspect the configured checkout; never throws for path/git failures. */
export class SourceResolver {
  private cache: { key: string; at: number; value: ResolvedSource | null } | undefined

  /** @param deps - path reader, git runner, and optional clock. */
  constructor(private readonly deps: SourceResolverDeps) {}

  /**
   * Synchronous, cached checkout resolution used by prompt providers.
   * @returns the checkout path/version, or null when the path is unset,
   *   relative, missing, not a directory, or not a DSH source checkout.
   */
  resolve(): ResolvedSource | null {
    const path = this.deps.readPath().trim()
    const now = (this.deps.now ?? Date.now)()
    if (this.cache !== undefined && this.cache.key === path && now - this.cache.at < RESOLVE_TTL_MS) {
      return this.cache.value
    }
    const value = this.readResolved(path)
    this.cache = { key: path, at: now, value }
    return value
  }

  /** Clear the synchronous cache after an update changes the checkout. */
  invalidate(): void {
    this.cache = undefined
  }

  /**
   * Rich inspection for the configuration page.
   * @returns filesystem facts, git status/tag facts, and a structural error
   *   when the path cannot serve as a source checkout.
   */
  async inspect(): Promise<SourceInspection> {
    const path = this.deps.readPath().trim()
    const base: SourceInspection = {
      path,
      exists: false,
      directory: false,
      checkout: false,
      dependenciesInstalled: false,
    }
    if (path === '') return base
    if (!isAbsolute(path)) return { ...base, error: 'not-absolute' }

    let info
    try {
      info = await stat(path)
    } catch {
      return { ...base, error: 'not-found' }
    }
    if (!info.isDirectory()) return { ...base, exists: true, directory: false, error: 'not-directory' }

    const version = await readVersion(path)
    const checkout = await exists(join(path, CHECKOUT_MARKER))
    const dependenciesInstalled = await exists(join(path, 'node_modules', '.bin', 'tsdown'))
    const facts = { exists: true, directory: true, version, dependenciesInstalled }
    if (!checkout) return { ...base, ...facts, error: 'not-checkout' }

    const git = await this.inspectGit(path)
    return { ...base, ...facts, checkout: true, ...git }
  }

  private readResolved(path: string): ResolvedSource | null {
    if (path === '' || !isAbsolute(path)) return null
    let info
    try {
      info = statSync(path, { throwIfNoEntry: false })
    } catch {
      return null
    }
    if (info === undefined || !info.isDirectory()) return null
    if (!existsSync(join(path, CHECKOUT_MARKER))) return null
    const version = readVersionSync(path)
    return { path, ...version === undefined ? {} : { version } }
  }

  private async inspectGit(path: string): Promise<Partial<SourceInspection>> {
    let status: GitResult
    try {
      status = await this.deps.git.run(path, ['status', '--porcelain=v2', '--branch'], 15_000)
    } catch (error) {
      return { gitRepository: false, gitError: error instanceof Error ? error.message : String(error) }
    }
    if (status.timedOut === true) return { gitRepository: false, gitError: 'git status timed out' }
    if (status.exitCode !== 0) {
      const detail = (status.stderr.trim() || status.stdout.trim() || `git status exited ${String(status.exitCode)}`)
      return { gitRepository: false, gitError: capOutput(detail, 4 * 1024) }
    }
    const summary = parseGitStatusV2(status.stdout)
    let tag: string | undefined
    try {
      const described = await this.deps.git.run(path, ['describe', '--tags', '--exact-match', 'HEAD'], 15_000)
      if (described.timedOut !== true && described.exitCode === 0) tag = parseDescribeTag(described.stdout)
    } catch {
      // A missing exact tag is a normal result, not a git failure.
    }
    return { gitRepository: true, ...summary, ...tag === undefined ? {} : { tag } }
  }
}
