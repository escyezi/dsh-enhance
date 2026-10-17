/**
 * Host half of DSH增强: republishes the display values the browser half needs
 * and owns the Plan-X collaboration mode, its prompt section, command, and
 * plan-document tool.
 *
 * Every future enhancement that needs deployment configuration adds its field
 * here and in `EnhanceClientConfig`, rather than reaching for a second global.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-working-directory'
import type { EnhanceClientConfig, EnhanceConfig } from './types.ts'
import { ENHANCE_CONFIG_GLOBAL } from './client-config.ts'
import { parseEnhanceConfig } from './config.ts'
import { registerPlanXCommand } from './plan-x/command.ts'
import { registerPlanXPolicy } from './plan-x/policy.ts'
import { planXProjectionDefinition } from './plan-x/projection.ts'
import { registerPlanXTool } from './plan-x/tool.ts'

/** Cordis plugin name. */
export const name = 'dsh-enhance'

/**
 * Publish the browser half's configuration and mount Plan-X.
 *
 * Each Plan-X capability lives behind its own injection so a composition
 * without commands, fs, or a workspace still gets the balance feature and
 * never half-mounts the mode.
 *
 * @param ctx - registrant context carrying the web server.
 * @param config - the row's `config`, validated here.
 * @throws Error when the row's configuration is invalid.
 */
export function apply(ctx: Context, config: unknown): void {
  const parsed: EnhanceConfig = parseEnhanceConfig(config)
  const published: EnhanceClientConfig = { balanceRefreshMs: parsed.balanceRefreshMs }
  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'global',
      name: ENHANCE_CONFIG_GLOBAL,
      value: published,
    })
  })

  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(planXProjectionDefinition)
    projectionCtx.inject(['systemPrompt'], (promptCtx) => {
      registerPlanXPolicy(promptCtx)
    })
    projectionCtx.inject(['tools', 'fs', 'workingDirectory'], (toolCtx) => {
      registerPlanXTool(toolCtx)
    })
    projectionCtx.inject(['commands'], (commandCtx) => {
      registerPlanXCommand(commandCtx)
    })
  })
}
