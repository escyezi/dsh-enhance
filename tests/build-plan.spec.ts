import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { buildPlan, type BuildCommandResult, type BuildPlanDeps, type BuildPromptResult } from '../packages/plan-x/src/client/build-plan.ts'

const ID = 'session-1' as SessionId
const PATH = '.dsh/plans/dark.plan.md'

function setup(overrides: Partial<BuildPlanDeps> = {}) {
  const sendPrompt = vi.fn(async (_sessionId: SessionId, _text: string): Promise<BuildPromptResult> => ({ ok: true }))
  const executeCommand = vi.fn(async (): Promise<BuildCommandResult> => ({ ok: true, value: {} }))
  const deps: BuildPlanDeps = {
    executeCommand,
    sendPrompt,
    ...overrides,
  }
  return { deps, executeCommand, sendPrompt }
}

describe('buildPlan', () => {
  it('leaves Plan-X and sends the execution prompt', async () => {
    const { deps, executeCommand, sendPrompt } = setup()
    await expect(buildPlan(deps, ID, PATH)).resolves.toBeNull()
    expect(executeCommand).toHaveBeenCalledWith(ID, '/plan-x off')
    expect(sendPrompt).toHaveBeenCalledOnce()
    const [sessionId, prompt] = sendPrompt.mock.calls[0]
    expect(sessionId).toBe(ID)
    expect(prompt).toContain(PATH)
    expect(prompt).toContain('carry out the plan')
  })

  it('returns a command failure with its code', async () => {
    const { deps, sendPrompt } = setup({
      executeCommand: async () => ({ ok: false, error: { message: 'mode switch failed', code: 'plan-x/switch' } }),
    })
    await expect(buildPlan(deps, ID, PATH)).resolves.toBe('mode switch failed (plan-x/switch)')
    expect(sendPrompt).not.toHaveBeenCalled()
  })

  it('reports an unknown off command', async () => {
    const { deps } = setup({ executeCommand: async () => ({ ok: true, value: undefined }) })
    await expect(buildPlan(deps, ID, PATH)).resolves.toBe('unknown command: /plan-x off')
  })

  it('returns a prompt failure with its code', async () => {
    const { deps } = setup({
      sendPrompt: async () => ({ ok: false, error: { message: 'no model selected', code: 'session/model-unavailable' } }),
    })
    await expect(buildPlan(deps, ID, PATH)).resolves.toBe('no model selected (session/model-unavailable)')
  })

  it('does not send the prompt when leaving Plan-X fails', async () => {
    const { deps, sendPrompt } = setup({
      executeCommand: async () => ({ ok: false, error: { message: 'offline', code: 'remote/offline' } }),
    })
    await buildPlan(deps, ID, PATH)
    expect(sendPrompt).not.toHaveBeenCalled()
  })
})
