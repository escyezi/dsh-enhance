/**
 * The `/plan-x` command: the single state transition the UI toggle and typed
 * command share. The command's own log records are the persisted mode state, so
 * the handler only validates the argument and, when entering Plan-X, retires the
 * built-in plan mode so the two guidance sections cannot compete.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-plan-mode'

/** Command name without the leading slash. */
export const PLAN_X_COMMAND = 'plan-x'

/**
 * Register the Plan-X mode command.
 * @param ctx - context carrying the command registry and, optionally, plan mode.
 */
export function registerPlanXCommand(ctx: Context): void {
  ctx.commands.register({
    name: PLAN_X_COMMAND,
    description: 'Enter or leave Plan-X mode',
    input: { hint: '[on|off]' },
    handler: ({ agent, rawInput }) => {
      const argument = rawInput.trim()
      if (argument !== '' && argument !== 'on' && argument !== 'off') {
        return { kind: 'error', text: 'Use /plan-x on or /plan-x off.' }
      }
      const wanted = argument !== 'off'
      if (wanted) {
        // Plan-X and the built-in plan mode would inject competing guidance.
        // The built-in controller may be absent in a minimal composition.
        ctx.get('planMode')?.set(agent, false)
      }
      return {
        kind: 'success',
        text: wanted
          ? 'Plan-X mode on. Plans are written under .dsh/plans; the document Build button starts implementation.'
          : 'Plan-X mode off.',
      }
    },
  })
}
