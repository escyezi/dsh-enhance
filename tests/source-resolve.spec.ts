import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GitResult, GitRunner } from '../packages/source/src/git.ts'
import {
  CHECKOUT_MARKER,
  SourceResolver,
  parseDescribeTag,
  parseGitStatusV2,
} from '../packages/source/src/resolve.ts'

const roots: string[] = []

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-source-resolve-'))
  roots.push(root)
  return root
}

function checkout(root: string, version = '0.2.1-rc.2'): string {
  const path = join(root, 'deepseek-harness')
  mkdirSync(join(path, 'packages', 'client'), { recursive: true })
  writeFileSync(join(path, CHECKOUT_MARKER), 'export {}\n')
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-root', version }))
  return path
}

function fakeGit(handler: (args: readonly string[]) => GitResult | Promise<GitResult>): GitRunner {
  return {
    async ensureAvailable() {},
    async run(_cwd, args) {
      return await handler(args)
    },
  }
}

const cleanStatus = [
  '# branch.oid 1234567890abcdef1234567890abcdef12345678',
  '# branch.head master',
  '# branch.upstream origin/master',
  '# branch.ab +0 -0',
].join('\n')

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('parseGitStatusV2', () => {
  it('reads a clean tracked branch', () => {
    expect(parseGitStatusV2(cleanStatus)).toEqual({
      head: '12345678',
      branch: 'master',
      upstream: 'origin/master',
      ahead: 0,
      behind: 0,
      dirty: false,
    })
  })

  it('reads ahead/behind counts', () => {
    expect(parseGitStatusV2(cleanStatus.replace('+0 -0', '+2 -3'))).toMatchObject({
      ahead: 2, behind: 3, dirty: false,
    })
  })

  it('marks any non-header line as dirty', () => {
    expect(parseGitStatusV2(`${cleanStatus}\n1 .M N... 100644 100644 100644 abc abc file.ts`).dirty)
      .toBe(true)
  })

  it('reads a detached HEAD without a branch', () => {
    const parsed = parseGitStatusV2([
      '# branch.oid 1234567890abcdef',
      '# branch.head (detached)',
    ].join('\n'))
    expect(parsed.detached).toBe(true)
    expect(parsed.branch).toBeUndefined()
  })

  it('reads a branch without an upstream', () => {
    const parsed = parseGitStatusV2(['# branch.oid abcdef1234567890', '# branch.head dev'].join('\n'))
    expect(parsed.branch).toBe('dev')
    expect(parsed.upstream).toBeUndefined()
    expect(parsed.ahead).toBeUndefined()
  })

  it('handles empty and CRLF output', () => {
    expect(parseGitStatusV2('')).toEqual({ dirty: false })
    expect(parseGitStatusV2(cleanStatus.replaceAll('\n', '\r\n'))).toMatchObject({ branch: 'master' })
  })
})

describe('parseDescribeTag', () => {
  it('returns the exact tag', () => {
    expect(parseDescribeTag('dsh-v0.2.1-rc.2\n')).toBe('dsh-v0.2.1-rc.2')
  })

  it('returns undefined for empty or blank output', () => {
    expect(parseDescribeTag('')).toBeUndefined()
    expect(parseDescribeTag('\n  \n')).toBeUndefined()
  })
})

describe('SourceResolver.resolve', () => {
  it('resolves an absolute DSH checkout and its version', () => {
    const path = checkout(tempRoot())
    const resolver = new SourceResolver({ readPath: () => path, git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    expect(resolver.resolve()).toEqual({ path, version: '0.2.1-rc.2' })
  })

  it('rejects an empty, relative, missing, or marker-less path', () => {
    const root = tempRoot()
    const empty = new SourceResolver({ readPath: () => '', git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    const relative = new SourceResolver({ readPath: () => 'deepseek-harness', git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    const missing = new SourceResolver({ readPath: () => join(root, 'missing'), git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    mkdirSync(join(root, 'not-a-checkout'), { recursive: true })
    const plain = new SourceResolver({ readPath: () => join(root, 'not-a-checkout'), git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    expect(empty.resolve()).toBeNull()
    expect(relative.resolve()).toBeNull()
    expect(missing.resolve()).toBeNull()
    expect(plain.resolve()).toBeNull()
  })

  it('reuses the synchronous result until the TTL expires or it is invalidated', () => {
    const path = checkout(tempRoot())
    let now = 0
    const resolver = new SourceResolver({ readPath: () => path, git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })), now: () => now })
    expect(resolver.resolve()).toEqual({ path, version: '0.2.1-rc.2' })
    rmSync(path, { recursive: true, force: true })
    now = 4_999
    expect(resolver.resolve()).toEqual({ path, version: '0.2.1-rc.2' })
    now = 5_000
    expect(resolver.resolve()).toBeNull()
  })
})

describe('SourceResolver.inspect', () => {
  it('reports a DSH checkout with git facts, tag, and dependencies', async () => {
    const path = checkout(tempRoot())
    mkdirSync(join(path, 'node_modules', '.bin'), { recursive: true })
    writeFileSync(join(path, 'node_modules', '.bin', 'tsdown'), '')
    const resolver = new SourceResolver({
      readPath: () => path,
      git: fakeGit((args) => args[0] === 'status'
        ? { exitCode: 0, stdout: cleanStatus, stderr: '' }
        : { exitCode: 0, stdout: 'dsh-v0.2.1-rc.2\n', stderr: '' }),
    })
    const inspection = await resolver.inspect()
    expect(inspection).toMatchObject({
      path,
      exists: true,
      directory: true,
      checkout: true,
      version: '0.2.1-rc.2',
      branch: 'master',
      tag: 'dsh-v0.2.1-rc.2',
      gitRepository: true,
      dependenciesInstalled: true,
      dirty: false,
      head: '12345678',
    })
    expect(inspection.error).toBeUndefined()
  })

  it('reports structural path errors without throwing', async () => {
    const root = tempRoot()
    const relative = new SourceResolver({ readPath: () => 'relative', git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    expect(await relative.inspect()).toMatchObject({ error: 'not-absolute' })

    const missing = new SourceResolver({ readPath: () => join(root, 'missing'), git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    expect(await missing.inspect()).toMatchObject({ exists: false, error: 'not-found' })

    const file = join(root, 'file')
    writeFileSync(file, 'x')
    const plainFile = new SourceResolver({ readPath: () => file, git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    expect(await plainFile.inspect()).toMatchObject({ exists: true, directory: false, error: 'not-directory' })

    mkdirSync(join(root, 'plain'), { recursive: true })
    const notCheckout = new SourceResolver({ readPath: () => join(root, 'plain'), git: fakeGit(() => ({ exitCode: 1, stdout: '', stderr: '' })) })
    expect(await notCheckout.inspect()).toMatchObject({ exists: true, directory: true, checkout: false, error: 'not-checkout' })
  })

  it('keeps filesystem facts when git status fails', async () => {
    const path = checkout(tempRoot())
    const resolver = new SourceResolver({
      readPath: () => path,
      git: fakeGit(() => ({ exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' })),
    })
    const inspection = await resolver.inspect()
    expect(inspection).toMatchObject({
      checkout: true,
      gitRepository: false,
      gitError: 'fatal: not a git repository',
    })
  })

  it('omits the tag when describe finds no exact tag', async () => {
    const path = checkout(tempRoot())
    const resolver = new SourceResolver({
      readPath: () => path,
      git: fakeGit((args) => args[0] === 'status'
        ? { exitCode: 0, stdout: cleanStatus, stderr: '' }
        : { exitCode: 128, stdout: '', stderr: 'fatal: No names found' }),
    })
    const inspection = await resolver.inspect()
    expect(inspection.tag).toBeUndefined()
    expect(inspection.gitRepository).toBe(true)
  })
})
