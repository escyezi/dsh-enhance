/**
 * Git command execution for the source-reference feature.
 *
 * Every command is an argv array handed to the composed `subprocess` service;
 * no shell is involved. Output is collected with a bounded tail, ANSI escapes
 * are removed, and the caller's signal participates in cancellation alongside
 * the per-command deadline.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SubprocessHandle, SubprocessRuntime, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { SourceError } from './errors.ts'

/** One completed git command. */
export interface GitResult {
  /** Exit code, or null when the process failed to start or died from a signal. */
  exitCode: number | null
  /** Collected stdout, ANSI-stripped and bounded. */
  stdout: string
  /** Collected stderr, ANSI-stripped and bounded. */
  stderr: string
  /** Whether the per-command deadline fired. */
  timedOut?: boolean
}

/** Injectable git executor; tests replace it with a scripted fake. */
export interface GitRunner {
  /** Reject with `git-missing` when the Host cannot resolve git. */
  ensureAvailable(): Promise<void>
  /**
   * Run one fixed git command.
   * @param cwd - checkout directory.
   * @param args - arguments after the executable.
   * @param timeoutMs - per-command deadline.
   * @param signal - caller-owned cancellation (plugin unload).
   * @returns exit code and bounded combined output.
   */
  run(cwd: string, args: readonly string[], timeoutMs: number, signal?: AbortSignal): Promise<GitResult>
}

/** Keep the last {@link MAX_OUTPUT} characters of a transcript. */
export const MAX_OUTPUT = 16 * 1024

/** Strip common SGR/CSI escape sequences from git progress output. */
export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '')
}

/**
 * Bound one transcript to its tail.
 * @param text - raw text.
 * @param max - maximum retained characters.
 * @returns the retained tail.
 */
export function capOutput(text: string, max = MAX_OUTPUT): string {
  return text.length <= max ? text : text.slice(-max)
}

/**
 * Build the production runner over the composed subprocess service.
 * @param ctx - Host context carrying `ctx.subprocess` when the capability exists.
 * @returns a lazy runner: service lookup happens when a command runs.
 */
export function createSubprocessGitRunner(ctx: Context): GitRunner {
  let subprocess: SubprocessRuntime | undefined
  // Capture the service once it is available. Reading `ctx.subprocess` via a
  // proxy without declaring the dependency throws in Cordis, and commands run
  // later than this registration.
  ctx.inject(['subprocess'], (capCtx) => {
    subprocess = Reflect.get(capCtx, 'subprocess') as SubprocessRuntime
    return () => { subprocess = undefined }
  })

  let executable: Promise<string> | undefined

  const resolve = (): Promise<string> => {
    if (executable !== undefined) return executable
    executable = (async () => {
      const service = subprocess
      if (service === undefined) throw new SourceError('git-missing', 'subprocess service is unavailable')
      try {
        return await service.resolveExecutable('git')
      } catch {
        throw new SourceError('git-missing', 'git is not available on this Host')
      }
    })()
    // A failed lookup must be retried on the next command instead of caching
    // the rejection for the plugin's whole life.
    executable.catch(() => { executable = undefined })
    return executable
  }

  return {
    async ensureAvailable() {
      await resolve()
    },

    async run(cwd, args, timeoutMs, signal) {
      const service = subprocess
      if (service === undefined) throw new SourceError('git-missing', 'subprocess service is unavailable')
      const exe = await resolve()
      if (signal?.aborted === true) throw new SourceError('git-failed', 'the operation was cancelled')

      const controller = new AbortController()
      const timeout = setTimeout(() => { controller.abort() }, timeoutMs)
      const cancel = (): void => { controller.abort() }
      signal?.addEventListener('abort', cancel, { once: true })
      const cleanup = (): void => {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', cancel)
      }

      const spec: SubprocessSpawnSpec = {
        argv: [exe, ...args],
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 32 * 1024 },
          stderr: { maxBytes: 32 * 1024 },
        },
        graceMs: 5000,
        env: { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
        signal: controller.signal,
      }

      let handle: SubprocessHandle
      try {
        handle = service.spawn(spec)
      } catch (error) {
        cleanup()
        throw new SourceError('git-failed', error instanceof Error ? error.message : String(error))
      }

      try {
        const outcome = await handle.done.catch((error: unknown) => {
          throw error
        })
        const stdout = capOutput(stripAnsi(handle.collected.stdout?.readFrom(0).text ?? ''))
        const stderr = capOutput(stripAnsi(handle.collected.stderr?.readFrom(0).text ?? ''))
        return {
          exitCode: outcome.exitCode,
          stdout,
          stderr,
          ...controller.signal.aborted ? { timedOut: true } : {},
        }
      } catch (error) {
        if (error instanceof SourceError) throw error
        const stdout = capOutput(stripAnsi(handle.collected.stdout?.readFrom(0).text ?? ''))
        const stderr = capOutput(stripAnsi(handle.collected.stderr?.readFrom(0).text ?? ''))
        return {
          exitCode: null,
          stdout,
          stderr: stderr === '' ? error instanceof Error ? error.message : String(error) : stderr,
          timedOut: controller.signal.aborted,
        }
      } finally {
        cleanup()
      }
    },
  }
}
