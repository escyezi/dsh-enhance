/**
 * The Build operation behind the plan document button: leave Plan-X, then send
 * one ordinary execution prompt into the addressed session.
 *
 * The prompt goes through the session controller's Remote entry point rather
 * than the scoped Conversation service: the document tab can outlive the
 * Agent-scoped context, and the Remote accepts the session identity directly.
 *
 * @module
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** The slice of a command Remote result this operation needs. */
export type BuildCommandResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly message: string; readonly code: string } }

/** The slice of a prompt Remote result this operation needs. */
export type BuildPromptResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly message: string; readonly code: string } }

/** Host operations the Build flow calls. */
export interface BuildPlanDeps {
  /** Execute one slash command in the session. */
  executeCommand(sessionId: SessionId, command: string): Promise<BuildCommandResult>
  /** Admit one queued user prompt into the session. */
  sendPrompt(sessionId: SessionId, text: string): Promise<BuildPromptResult>
}

/**
 * Leave Plan-X and send the execution prompt for one plan document.
 * @param deps - command and prompt operations.
 * @param sessionId - session whose document is being built.
 * @param relativePath - workspace-relative `.dsh/plans/…` path.
 * @returns null when the prompt is queued, otherwise a user-visible failure.
 */
export async function buildPlan(
  deps: BuildPlanDeps,
  sessionId: SessionId,
  relativePath: string,
): Promise<string | null> {
  const off = await deps.executeCommand(sessionId, '/plan-x off')
  if (!off.ok) return `${off.error.message} (${off.error.code})`
  if (off.value === undefined) return 'unknown command: /plan-x off'

  const prompt = await deps.sendPrompt(
    sessionId,
    `Build the plan at ${relativePath}. Read the plan document, then implement it end to end. `
    + 'Do not ask for approval; carry out the plan.',
  )
  return prompt.ok ? null : `${prompt.error.message} (${prompt.error.code})`
}
