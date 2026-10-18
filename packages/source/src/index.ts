/**
 * Host half of the source-reference feature.
 *
 * One row contributes: a Creator-only prompt section/context naming a local
 * DeepSeek Harness checkout, plus authenticated local routes that inspect the
 * checkout and update it to the latest source or to the running DSH version.
 * The prompt and the routes share one resolver, so an update immediately feeds
 * the next prompt assembly.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { Config } from './config.ts'
import { createSubprocessGitRunner } from './git.ts'
import { registerSourcePolicy } from './policy.ts'
import { SourceResolver } from './resolve.ts'
import { createRuntimeVersionResolver } from './runtime.ts'
import { registerSourceRoutes } from './route.ts'
import { SourceUpdateManager } from './update.ts'

/** Cordis plugin name. */
export const name = 'dsh-enhance-source'

export { Config } from './config.ts'

/**
 * Mount the prompt guidance and the local update routes behind their optional
 * capabilities.
 * @param ctx - registrant context.
 * @param config - the row's validated configuration; `sourcePath` is volatile.
 */
export function apply(ctx: Context, config: Config): void {
  const readPath = (): string => config.sourcePath.get()
  const runner = createSubprocessGitRunner(ctx)
  const resolver = new SourceResolver({ readPath, git: runner })
  const runtimeVersion = createRuntimeVersionResolver(ctx)
  const manager = new SourceUpdateManager({ runner, resolver, readPath, runtimeVersion })

  ctx.effect(() => () => manager.dispose(), 'dsh-enhance-source: update manager')
  ctx.inject(['systemPrompt', 'agentPresets'], (promptCtx) => {
    registerSourcePolicy(promptCtx, resolver)
  })
  ctx.inject(['webServer', 'connection', 'subprocess'], (webCtx) => {
    registerSourceRoutes(webCtx, { resolver, manager, runtimeVersion })
  })
}
