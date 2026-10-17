/**
 * Host half of Plan-X: the session projection, the `/plan-x` command, the
 * collaboration policy, and the plan-document tool. Every capability mounts
 * behind its own injection, so a composition without projections, commands,
 * fs, or a workspace never half-mounts the mode.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-working-directory'
import { registerPlanXCommand } from './command.ts'
import { registerPlanXPolicy } from './policy.ts'
import { planXProjectionDefinition } from './projection.ts'
import { registerPlanXTool } from './tool.ts'

/** Cordis plugin name. */
export const name = 'dsh-enhance-plan-x'

/**
 * Mount Plan-X behind its optional capabilities.
 * @param ctx - registrant context.
 */
export function apply(ctx: Context): void {
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
