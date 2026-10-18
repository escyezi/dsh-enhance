/**
 * One-at-a-time source checkout updates.
 *
 * Two actions share this manager: `latest` fetches `origin`, checks out its
 * default branch, and fast-forwards it; `version` checks out the release tag
 * matching the running DSH version detected by the Host. Neither action resets,
 * stashes, cleans, or forces anything: git itself refuses unsafe transitions.
 *
 * @module
 */
import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { SourceError } from './errors.ts'
import { capOutput } from './git.ts'
import type { GitRunner } from './git.ts'
import type { SourceResolver } from './resolve.ts'
import { SEMVER } from './runtime.ts'
import {
  DSH_TAG_PREFIX,
  type RuntimeVersion,
  type SourceErrorCode,
  type SourceInspection,
  type SourceUpdateRequest,
  type UpdateAction,
  type UpdateStatus,
  type UpdateTarget,
} from './shared.ts'

/** Fetch/merge deadline for an update step. */
const NETWORK_TIMEOUT_MS = 10 * 60_000
/** Checkout deadline. */
const CHECKOUT_TIMEOUT_MS = 2 * 60_000
/** Small probe deadline. */
const PROBE_TIMEOUT_MS = 15_000
/** `git remote set-head` may contact the remote. */
const SET_HEAD_TIMEOUT_MS = 60_000

/** Dependencies of {@link SourceUpdateManager}. */
export interface SourceUpdateManagerDeps {
  /** Git executor. */
  runner: GitRunner
  /** Source inspection/resolution. */
  resolver: SourceResolver
  /** Read the current configured path. */
  readPath: () => string
  /** Detect the running DSH version. */
  runtimeVersion: () => RuntimeVersion | undefined
  /** Job-id injection for tests. */
  randomId?: () => string
}

interface Job {
  id: string
  action: UpdateAction
  phase: 'running' | 'succeeded' | 'failed'
  output: string
  target?: UpdateTarget
  changed?: boolean
  exitCode?: number | null
  before?: SourceInspection
  after?: SourceInspection
  warning?: 'dirty'
  error?: { code: SourceErrorCode; message: string }
  controller: AbortController
}

function failedStatus(error: unknown): { code: SourceErrorCode; message: string } {
  if (error instanceof SourceError) return { code: error.code, message: error.message }
  return { code: 'internal', message: error instanceof Error ? error.message : String(error) }
}

function append(job: Job, text: string): void {
  if (text === '') return
  const separator = job.output === '' || job.output.endsWith('\n') ? '' : '\n'
  job.output = capOutput(`${job.output}${separator}${text.endsWith('\n') ? text : `${text}\n`}`)
}

function pathFailure(inspection: SourceInspection): SourceError | undefined {
  switch (inspection.error) {
    case 'not-absolute': return new SourceError('not-absolute', 'the configured source path must be absolute')
    case 'not-found': return new SourceError('not-found', `the configured source path does not exist: ${inspection.path}`)
    case 'not-directory': return new SourceError('not-directory', `the configured source path is not a directory: ${inspection.path}`)
    case 'not-checkout': return new SourceError('not-checkout', `the configured path is not a DeepSeek Harness source checkout: ${inspection.path}`)
    default: break
  }
  if (!inspection.exists) return new SourceError('not-found', `the configured source path does not exist: ${inspection.path}`)
  if (!inspection.directory) return new SourceError('not-directory', `the configured source path is not a directory: ${inspection.path}`)
  if (!inspection.checkout) return new SourceError('not-checkout', `the configured path is not a DeepSeek Harness source checkout: ${inspection.path}`)
  if (inspection.gitRepository !== true) {
    return new SourceError('not-git', inspection.gitError ?? `the configured path is not a git repository: ${inspection.path}`)
  }
  return undefined
}

/** Resolve the default branch advertised by `origin`. */
export class SourceUpdateManager {
  private active: Job | undefined
  private last: Job | undefined

  /** @param deps - runner, resolver, path/version readers, and id injection. */
  constructor(private readonly deps: SourceUpdateManagerDeps) {}

  /**
   * Validate one request and start its job.
   * @param request - action selected by the page; the version is Host-detected.
   * @returns the job id for polling.
   * @throws {SourceError} for a busy manager, an unknown action, an invalid
   *   path/checkout, a missing git, or an unavailable runtime version.
   */
  async start(request: SourceUpdateRequest): Promise<{ id: string }> {
    if (this.active !== undefined && this.active.phase === 'running') {
      throw new SourceError('busy', 'another source update is already running')
    }
    const action = request.action
    if (action !== 'latest' && action !== 'version') {
      throw new SourceError('unknown-action', `unknown update action: ${String(action)}`)
    }
    const path = this.deps.readPath().trim()
    if (path === '') throw new SourceError('not-configured', 'no source checkout is configured')
    if (!isAbsolute(path)) throw new SourceError('not-absolute', 'the configured source path must be absolute')

    try {
      await this.deps.runner.ensureAvailable()
    } catch (error) {
      if (error instanceof SourceError) throw error
      throw new SourceError('git-missing', error instanceof Error ? error.message : String(error))
    }

    const before = await this.deps.resolver.inspect()
    const failure = pathFailure(before)
    if (failure !== undefined) throw failure

    let target: UpdateTarget | undefined
    if (action === 'version') {
      const runtime = this.deps.runtimeVersion()
      if (runtime === undefined) {
        throw new SourceError('runtime-version-unavailable', 'could not determine the running DeepSeek Harness version from the environment or an installed package')
      }
      if (!SEMVER.test(runtime.version)) {
        throw new SourceError('runtime-version-invalid', `the detected runtime version is not a valid release version: ${runtime.version}`)
      }
      target = { kind: 'tag', name: `${DSH_TAG_PREFIX}${runtime.version}` }
    }

    const id = (this.deps.randomId ?? randomUUID)()
    const job: Job = {
      id,
      action,
      phase: 'running',
      output: '',
      before,
      ...target === undefined ? {} : { target },
      ...before.dirty === true ? { warning: 'dirty' as const } : {},
      controller: new AbortController(),
    }
    this.active = job
    this.last = job
    void this.execute(job, path)
    return { id }
  }

  /**
   * Read one job's state.
   * @param id - job id returned by {@link start}.
   * @returns the status, or undefined for an unknown/expired id.
   */
  status(id: string): UpdateStatus | undefined {
    const job = this.active?.id === id ? this.active : this.last?.id === id ? this.last : undefined
    if (job === undefined) return undefined
    return {
      action: job.action,
      phase: job.phase,
      output: job.output,
      ...job.target === undefined ? {} : { target: job.target },
      ...job.changed === undefined ? {} : { changed: job.changed },
      ...job.exitCode === undefined ? {} : { exitCode: job.exitCode },
      ...job.before === undefined ? {} : { before: job.before },
      ...job.after === undefined ? {} : { after: job.after },
      ...job.warning === undefined ? {} : { warning: job.warning },
      ...job.error === undefined ? {} : { error: job.error },
    }
  }

  /** Cancel the active job; the Host calls this when the row unloads. */
  dispose(): void {
    this.active?.controller.abort()
    this.active = undefined
    this.last = undefined
  }

  private async execute(job: Job, path: string): Promise<void> {
    try {
      if (job.action === 'latest') await this.runLatest(job, path)
      else await this.runVersion(job, path)
      this.deps.resolver.invalidate()
      const after = await this.deps.resolver.inspect()
      job.after = after
      job.changed = job.before?.head !== after.head
      job.phase = 'succeeded'
    } catch (error) {
      job.phase = 'failed'
      job.error = failedStatus(error)
      if (error instanceof SourceError && error.exitCode !== undefined) job.exitCode = error.exitCode
    } finally {
      if (this.active === job) this.active = undefined
    }
  }

  private async runStep(job: Job, path: string, args: readonly string[], timeoutMs: number): Promise<string> {
    append(job, `$ git ${args.join(' ')}`)
    const result = await this.deps.runner.run(path, args, timeoutMs, job.controller.signal)
    const output = [result.stdout, result.stderr].filter(text => text !== '').join('\n')
    append(job, output)
    if (result.timedOut === true) {
      throw new SourceError('git-timeout', `git ${args.join(' ')} timed out`, null)
    }
    if (result.exitCode !== 0) {
      throw new SourceError('git-failed', `git ${args.join(' ')} exited ${String(result.exitCode)}`, result.exitCode)
    }
    return output
  }

  private async runLatest(job: Job, path: string): Promise<void> {
    await this.ensureNotCancelled(job)
    await this.runStep(job, path, ['fetch', '--prune', 'origin'], NETWORK_TIMEOUT_MS)
    const branch = await this.resolveDefaultBranch(job, path)
    await this.ensureNotCancelled(job)

    const local = await this.deps.runner.run(
      path,
      ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
      PROBE_TIMEOUT_MS,
      job.controller.signal,
    )
    if (local.timedOut === true) throw new SourceError('git-timeout', `git show-ref for ${branch} timed out`, null)
    if (local.exitCode !== 0 && local.exitCode !== 1) {
      throw new SourceError('git-failed', `git show-ref for ${branch} exited ${String(local.exitCode)}`, local.exitCode)
    }
    if (local.exitCode === 0) {
      await this.runStep(job, path, ['checkout', branch], CHECKOUT_TIMEOUT_MS)
    } else {
      await this.runStep(job, path, ['checkout', '-b', branch, '--track', `origin/${branch}`], CHECKOUT_TIMEOUT_MS)
    }
    await this.runStep(job, path, ['merge', '--ff-only', `origin/${branch}`], NETWORK_TIMEOUT_MS)
    job.target = { kind: 'branch', name: branch }
  }

  private async resolveDefaultBranch(job: Job, path: string): Promise<string> {
    const symbolic = await this.deps.runner.run(
      path,
      ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
      PROBE_TIMEOUT_MS,
      job.controller.signal,
    )
    const fromSymbolic = this.branchFromSymbolicRef(symbolic.stdout)
    if (fromSymbolic !== undefined) return fromSymbolic

    const setHead = await this.deps.runner.run(
      path,
      ['remote', 'set-head', 'origin', '--auto'],
      SET_HEAD_TIMEOUT_MS,
      job.controller.signal,
    )
    append(job, [setHead.stdout, setHead.stderr].filter(text => text !== '').join('\n'))
    if (setHead.exitCode === 0) {
      const retried = await this.deps.runner.run(
        path,
        ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
        PROBE_TIMEOUT_MS,
        job.controller.signal,
      )
      const branch = this.branchFromSymbolicRef(retried.stdout)
      if (branch !== undefined) return branch
    }

    const remote = await this.deps.runner.run(
      path,
      ['ls-remote', '--symref', 'origin', 'HEAD'],
      SET_HEAD_TIMEOUT_MS,
      job.controller.signal,
    )
    append(job, [remote.stdout, remote.stderr].filter(text => text !== '').join('\n'))
    if (remote.exitCode === 0) {
      const match = /^ref:\s+refs\/heads\/(\S+)\s+HEAD$/mu.exec(remote.stdout)
      if (match?.[1] !== undefined) return match[1]
    }
    throw new SourceError('no-default-branch', 'could not determine the default branch of origin')
  }

  private branchFromSymbolicRef(text: string): string | undefined {
    const ref = text.split('\n').map(line => line.trim()).find(line => line !== '')
    if (ref === undefined) return undefined
    const branch = ref.startsWith('origin/') ? ref.slice('origin/'.length) : ref
    return branch === '' ? undefined : branch
  }

  private async runVersion(job: Job, path: string): Promise<void> {
    const target = job.target
    if (target?.kind !== 'tag') throw new SourceError('internal', 'the version action has no target tag')
    const tag = target.name
    await this.ensureNotCancelled(job)
    await this.runStep(job, path, ['fetch', '--tags', 'origin'], NETWORK_TIMEOUT_MS)
    await this.ensureNotCancelled(job)

    const verify = await this.deps.runner.run(
      path,
      ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`],
      PROBE_TIMEOUT_MS,
      job.controller.signal,
    )
    if (verify.timedOut === true) throw new SourceError('git-timeout', `git rev-parse for ${tag} timed out`, null)
    if (verify.exitCode !== 0) {
      throw new SourceError('tag-not-found', `release tag ${tag} was not found after fetching tags`, verify.exitCode)
    }
    await this.runStep(job, path, ['checkout', '--detach', `refs/tags/${tag}`], CHECKOUT_TIMEOUT_MS)
  }

  private async ensureNotCancelled(job: Job): Promise<void> {
    if (job.controller.signal.aborted) throw new SourceError('git-failed', 'the update was cancelled')
  }
}
