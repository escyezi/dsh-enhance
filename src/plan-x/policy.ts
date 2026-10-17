/**
 * Plan-X guidance: included only while Plan-X is active and the built-in plan
 * mode is not, so the model reads exactly one planning policy.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-plan-mode'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { PLAN_DIRECTORY, PLAN_SUFFIX } from './types.ts'

/** Deployment-owned guidance for the Plan-X collaboration mode. */
const PLAN_X_POLICY = `Plan-X mode is active. This session is for planning, not implementation.

- Write every plan as a Markdown file under \`${PLAN_DIRECTORY}/\`, ending in \`${PLAN_SUFFIX}\`. Use the \`plan_x_write\` tool for every creation and revision; it never requires approval and never ends the turn.
- Start each plan with a \`#\` heading that names it. Choose a descriptive kebab-case path, for example \`${PLAN_DIRECTORY}/add-dark-mode${PLAN_SUFFIX}\`.
- To revise an existing plan, read that file first and write the complete revised Markdown back to the same path. Before creating a plan, look for an existing plan that already covers the request and update it instead of creating a duplicate.
- Do not edit source code in this mode. Do not ask for approval, do not call \`exit_plan_mode\`, and do not stop after writing a plan. Keep the normal conversation going and apply the user's changes to the plan document.
- When a plan is ready, say so and link the plan file. The user starts implementation with the Build button in the document; never start implementing the plan yourself.
- Write the plan in the user's language.`

/** Prompt-section name, distinct from the built-in plan policy. */
export const PLAN_X_POLICY_SECTION = 'plan-x:policy'

/**
 * Register the Plan-X prompt section.
 * @param ctx - context carrying the system prompt and session projections.
 */
export function registerPlanXPolicy(ctx: Context): void {
  ctx.systemPrompt.section({
    name: PLAN_X_POLICY_SECTION,
    order: ctx.systemPrompt.getSectionOrder('PLAN_POLICY'),
    text: (context) => {
      const agent = context.agent
      if (agent === undefined) return ''
      const planX = ctx.sessionProjections.stateOf(agent.session, 'planX')
      if (planX?.active !== true) return ''
      // The built-in plan mode owns the turn if both are somehow active; the
      // command normally retires it, but a resumed log can predate that rule.
      const plan = ctx.sessionProjections.stateOf(agent.session, 'plan')
      return plan?.active === true ? '' : PLAN_X_POLICY
    },
  })
}
