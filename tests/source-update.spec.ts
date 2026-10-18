import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SourceError } from '../packages/source/src/errors.ts'
import { capOutput, stripAnsi, type GitResult, type GitRunner } from '../packages/source/src/git.ts'
import { SourceResolver } from '../packages/source/src/resolve.ts'
import { SourceUpdateManager } from '../packages/source/src/update.ts'
import type { RuntimeVersion, SourceInspection, UpdateStatus } from '../packages/source/src/shared.ts'

const execFileP = promisify(execFile)
const GIT_AVAILABLE = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0
const roots: string[] = []

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-source-update-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function ok(stdout = ''): GitResult {
  return { exitCode: 0, stdout, stderr: '' }
}

function fail(exitCode = 1, stderr = 'failed'): GitResult {
  return { exitCode, stdout: '', stderr }
}

class FakeRunner implements GitRunner {
  readonly calls: string[][] = []

  constructor(private readonly handler: (args: readonly string[]) => GitResult | Promise<GitResult>) {}

  async ensureAvailable(): Promise<void> {}

  async run(_cwd: string, args: readonly string[]): Promise<GitResult> {
    this.calls.push([...args])
    return await this.handler(args)
  }
}

class FakeResolver {
  inspectCount = 0
  invalidated = 0

  constructor(
    private readonly before: SourceInspection,
    private readonly after: SourceInspection = before,
  ) {}

  resolve(): null {
    return null
  }

  async inspect(): Promise<SourceInspection> {
    this.inspectCount += 1
    return this.inspectCount === 1 ? this.before : this.after
  }

  invalidate(): void {
    this.invalidated += 1
  }
}

function inspection(overrides: Partial<SourceInspection> = {}): SourceInspection {
  return {
    path: '/tmp/source',
    exists: true,
    directory: true,
    checkout: true,
    gitRepository: true,
    dependenciesInstalled: true,
    dirty: false,
    head: 'aaaa1111',
    ...overrides,
  }
}

function managerFor(
  runner: GitRunner,
  resolver: FakeResolver,
  runtime: RuntimeVersion | null = { version: '0.2.1-rc.2', source: 'env' },
): SourceUpdateManager {
  return new SourceUpdateManager({
    runner,
    resolver: resolver as unknown as SourceResolver,
    readPath: () => '/tmp/source',
    runtimeVersion: () => runtime ?? undefined,
    randomId: () => 'job-1',
  })
}

async function settle(manager: SourceUpdateManager, id: string): Promise<UpdateStatus> {
  for (let attempt = 0; attempt < 1500; attempt += 1) {
    const status = manager.status(id)
    if (status !== undefined && status.phase !== 'running') return status
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('the update job did not settle')
}

describe('stripAnsi and capOutput', () => {
  it('removes terminal escapes and keeps the tail', () => {
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red')
    expect(capOutput('abcdef', 3)).toBe('def')
    expect(capOutput('abc', 10)).toBe('abc')
  })
})

describe('SourceUpdateManager latest', () => {
  it('fetches, resolves the default branch, checks it out, and fast-forwards', async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === 'fetch') return ok('fetched')
      if (args[0] === 'symbolic-ref') return ok('origin/master\n')
      if (args[0] === 'show-ref') return ok()
      if (args[0] === 'checkout') return ok()
      if (args[0] === 'merge') return ok('Fast-forward')
      return ok()
    })
    const resolver = new FakeResolver(inspection(), inspection({ head: 'bbbb2222' }))
    const manager = managerFor(runner, resolver)
    const { id } = await manager.start({ action: 'latest' })
    const status = await settle(manager, id)
    expect(status.phase).toBe('succeeded')
    expect(status.target).toEqual({ kind: 'branch', name: 'master' })
    expect(status.changed).toBe(true)
    expect(status.before?.head).toBe('aaaa1111')
    expect(status.after?.head).toBe('bbbb2222')
    expect(resolver.invalidated).toBe(1)
    expect(runner.calls.map(call => call[0])).toEqual(['fetch', 'symbolic-ref', 'show-ref', 'checkout', 'merge'])
    expect(runner.calls.at(-1)).toEqual(['merge', '--ff-only', 'origin/master'])
    expect(status.output).toContain('$ git merge --ff-only origin/master')
    expect(status.output).toContain('Fast-forward')
  })

  it('recovers the default branch via set-head when origin/HEAD is missing', async () => {
    let symbolicCalls = 0
    const runner = new FakeRunner((args) => {
      if (args[0] === 'fetch') return ok()
      if (args[0] === 'symbolic-ref') {
        symbolicCalls += 1
        return symbolicCalls === 1 ? fail(1, '') : ok('origin/main\n')
      }
      if (args[0] === 'remote') return ok('HEAD branch: main')
      if (args[0] === 'show-ref') return ok()
      return ok()
    })
    const manager = managerFor(runner, new FakeResolver(inspection(), inspection({ head: 'bbbb2222' })))
    const status = await settle(manager, (await manager.start({ action: 'latest' })).id)
    expect(status.phase).toBe('succeeded')
    expect(status.target).toEqual({ kind: 'branch', name: 'main' })
    expect(runner.calls.some(call => call[0] === 'remote' && call[1] === 'set-head')).toBe(true)
  })

  it('recovers the default branch via ls-remote when set-head cannot answer', async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === 'fetch') return ok()
      if (args[0] === 'symbolic-ref') return fail(1, '')
      if (args[0] === 'remote') return fail(1, 'no remote head')
      if (args[0] === 'ls-remote') return ok('ref: refs/heads/trunk\tHEAD\nabcdef\tHEAD\n')
      if (args[0] === 'show-ref') return ok()
      return ok()
    })
    const manager = managerFor(runner, new FakeResolver(inspection(), inspection({ head: 'bbbb2222' })))
    const status = await settle(manager, (await manager.start({ action: 'latest' })).id)
    expect(status.phase).toBe('succeeded')
    expect(status.target).toEqual({ kind: 'branch', name: 'trunk' })
  })

  it('fails with no-default-branch when every resolution path fails', async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === 'fetch') return ok()
      if (args[0] === 'symbolic-ref') return fail(1, '')
      if (args[0] === 'remote') return fail(1, 'no remote head')
      if (args[0] === 'ls-remote') return fail(1, 'offline')
      return ok()
    })
    const manager = managerFor(runner, new FakeResolver(inspection()))
    const status = await settle(manager, (await manager.start({ action: 'latest' })).id)
    expect(status.phase).toBe('failed')
    expect(status.error?.code).toBe('no-default-branch')
  })

  it('fails with git-failed and keeps the output when merge rejects', async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === 'fetch') return ok()
      if (args[0] === 'symbolic-ref') return ok('origin/master\n')
      if (args[0] === 'show-ref') return ok()
      if (args[0] === 'merge') return fail(1, 'fatal: Not possible to fast-forward')
      return ok()
    })
    const manager = managerFor(runner, new FakeResolver(inspection()))
    const status = await settle(manager, (await manager.start({ action: 'latest' })).id)
    expect(status.phase).toBe('failed')
    expect(status.error?.code).toBe('git-failed')
    expect(status.exitCode).toBe(1)
    expect(status.output).toContain('Not possible to fast-forward')
  })

  it('reports a timeline timeout', async () => {
    const runner = new FakeRunner((args) => args[0] === 'fetch'
      ? { exitCode: 0, stdout: '', stderr: '', timedOut: true }
      : ok())
    const manager = managerFor(runner, new FakeResolver(inspection()))
    const status = await settle(manager, (await manager.start({ action: 'latest' })).id)
    expect(status.phase).toBe('failed')
    expect(status.error?.code).toBe('git-timeout')
  })

  it('marks a dirty worktree with a warning but still attempts the update', async () => {
    const runner = new FakeRunner((args) => {
      if (args[0] === 'symbolic-ref') return ok('origin/master\n')
      if (args[0] === 'show-ref') return ok()
      return ok()
    })
    const manager = managerFor(runner, new FakeResolver(inspection({ dirty: true }), inspection({ dirty: true, head: 'bbbb2222' })))
    const status = await settle(manager, (await manager.start({ action: 'latest' })).id)
    expect(status.phase).toBe('succeeded')
    expect(status.warning).toBe('dirty')
  })
})

describe('SourceUpdateManager version', () => {
  it('checks out the dsh-v tag matching the Host-detected runtime version', async () => {
    const runner = new FakeRunner((args) => ok())
    const resolver = new FakeResolver(inspection(), inspection({ head: 'cccc3333', detached: true, tag: 'dsh-v0.2.1-rc.2' }))
    const manager = managerFor(runner, resolver)
    const status = await settle(manager, (await manager.start({ action: 'version' })).id)
    expect(status.phase).toBe('succeeded')
    expect(status.target).toEqual({ kind: 'tag', name: 'dsh-v0.2.1-rc.2' })
    expect(runner.calls).toEqual([
      ['fetch', '--tags', 'origin'],
      ['rev-parse', '--verify', '--quiet', 'refs/tags/dsh-v0.2.1-rc.2^{commit}'],
      ['checkout', '--detach', 'refs/tags/dsh-v0.2.1-rc.2'],
    ])
    expect(status.output).toContain('$ git checkout --detach refs/tags/dsh-v0.2.1-rc.2')
  })

  it('fails with tag-not-found when the release tag is absent', async () => {
    const runner = new FakeRunner((args) => args[0] === 'rev-parse' ? fail(1, '') : ok())
    const manager = managerFor(runner, new FakeResolver(inspection()))
    const status = await settle(manager, (await manager.start({ action: 'version' })).id)
    expect(status.phase).toBe('failed')
    expect(status.error?.code).toBe('tag-not-found')
    expect(status.error?.message).toContain('dsh-v0.2.1-rc.2')
  })

  it('refuses to start without a runtime version', async () => {
    const manager = managerFor(new FakeRunner(() => ok()), new FakeResolver(inspection()), null)
    await expect(manager.start({ action: 'version' })).rejects.toMatchObject({
      code: 'runtime-version-unavailable',
    })
  })

  it('refuses an invalid detected runtime version', async () => {
    const manager = managerFor(new FakeRunner(() => ok()), new FakeResolver(inspection()), { version: 'nope', source: 'env' })
    await expect(manager.start({ action: 'version' })).rejects.toMatchObject({
      code: 'runtime-version-invalid',
    })
  })
})

describe('SourceUpdateManager guards', () => {
  it('rejects a busy manager', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const runner = new FakeRunner(async (args) => {
      if (args[0] === 'fetch') await gate
      if (args[0] === 'symbolic-ref') return ok('origin/master\n')
      if (args[0] === 'show-ref') return ok()
      return ok()
    })
    const manager = managerFor(runner, new FakeResolver(inspection(), inspection({ head: 'bbbb2222' })))
    const { id } = await manager.start({ action: 'latest' })
    await expect(manager.start({ action: 'latest' })).rejects.toMatchObject({ code: 'busy' })
    release()
    await settle(manager, id)
  })

  it('rejects a path that is not a DSH checkout or not a git repository', async () => {
    const notCheckout = managerFor(new FakeRunner(() => ok()), new FakeResolver(inspection({ checkout: false, error: 'not-checkout' })))
    await expect(notCheckout.start({ action: 'latest' })).rejects.toMatchObject({ code: 'not-checkout' })

    const notGit = managerFor(new FakeRunner(() => ok()), new FakeResolver(inspection({ gitRepository: false, gitError: 'not a repository' })))
    await expect(notGit.start({ action: 'latest' })).rejects.toMatchObject({ code: 'not-git' })
  })

  it('rejects unknown actions and unknown job ids', async () => {
    const manager = managerFor(new FakeRunner(() => ok()), new FakeResolver(inspection()))
    await expect(manager.start({ action: 'other' } as never)).rejects.toMatchObject({ code: 'unknown-action' })
    expect(manager.status('missing')).toBeUndefined()
  })
})

describe('SourceUpdateManager real git integration', () => {
  it.skipIf(!GIT_AVAILABLE)('switches between latest and the runtime tag without resetting', async () => {
    const root = tempRoot()
    const remote = join(root, 'remote.git')
    const work = join(root, 'work')
    const run = async (cwd: string, args: string[]): Promise<string> => {
      const { stdout } = await execFileP('git', args, { cwd, maxBuffer: 1024 * 1024 })
      return String(stdout)
    }
    await run(root, ['init', '--bare', remote])
    await run(root, ['clone', remote, work])
    await run(work, ['config', 'user.email', 'test@example.com'])
    await run(work, ['config', 'user.name', 'Test'])
    mkdirSync(join(work, 'packages', 'client'), { recursive: true })
    writeFileSync(join(work, 'packages', 'client', 'tsdown.client.ts'), 'export {}\n')
    writeFileSync(join(work, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-root', version: '0.2.1-rc.2' }))
    await run(work, ['add', '.'])
    await run(work, ['commit', '-m', 'first'])
    await run(work, ['tag', 'dsh-v0.2.1-rc.2'])
    const branch = (await run(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    await run(work, ['push', 'origin', branch, '--tags'])
    writeFileSync(join(work, 'second.txt'), 'second\n')
    await run(work, ['add', '.'])
    await run(work, ['commit', '-m', 'second'])
    await run(work, ['push', 'origin', branch])
    const second = (await run(work, ['rev-parse', 'HEAD'])).trim()

    const runner: GitRunner = {
      async ensureAvailable() {
        await execFileP('git', ['--version'])
      },
      async run(cwd, args, timeout, signal) {
        try {
          const { stdout, stderr } = await execFileP('git', args, { cwd, timeout, signal, maxBuffer: 1024 * 1024 })
          return { exitCode: 0, stdout: String(stdout), stderr: String(stderr) }
        } catch (error) {
          const failure = error as { code?: number; stdout?: string; stderr?: string }
          return {
            exitCode: typeof failure.code === 'number' ? failure.code : null,
            stdout: String(failure.stdout ?? ''),
            stderr: String(failure.stderr ?? ''),
          }
        }
      },
    }
    const resolver = new SourceResolver({ readPath: () => work, git: runner })
    const manager = new SourceUpdateManager({
      runner,
      resolver,
      readPath: () => work,
      runtimeVersion: () => ({ version: '0.2.1-rc.2', source: 'env' }),
      randomId: () => 'real-job',
    })

    const versionStatus = await settle(manager, (await manager.start({ action: 'version' })).id)
    expect(versionStatus.phase).toBe('succeeded')
    expect((await run(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()).toBe('HEAD')
    expect((await run(work, ['describe', '--tags', '--exact-match', 'HEAD'])).trim()).toBe('dsh-v0.2.1-rc.2')

    const latestStatus = await settle(manager, (await manager.start({ action: 'latest' })).id)
    expect(latestStatus.phase).toBe('succeeded')
    expect((await run(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()).toBe(branch)
    expect((await run(work, ['rev-parse', 'HEAD'])).trim()).toBe(second)
  }, 30_000)
})
