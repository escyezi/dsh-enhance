import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { PLAN_X_COMMAND, registerPlanXCommand } from '../src/plan-x/command.ts'

interface Fake {
  definition: CommandDefinition
  planMode: { set: ReturnType<typeof vi.fn> }
}

function fakeContext(withPlanMode = true): Fake {
  let definition: CommandDefinition | undefined
  const planMode = { set: vi.fn() }
  const ctx = {
    commands: {
      register: (value: CommandDefinition) => {
        definition = value
        return () => {}
      },
    },
    get: (key: string) => key === 'planMode' && withPlanMode ? planMode : undefined,
  } as unknown as Context
  registerPlanXCommand(ctx)
  if (definition === undefined) throw new Error('command was not registered')
  return { definition, planMode }
}

function invoke(definition: CommandDefinition, rawInput: string) {
  return definition.handler({
    agent: { session: {} } as never,
    rawInput,
    attachments: [],
    signal: new AbortController().signal,
  } as never)
}

describe('/plan-x command', () => {
  it('registers its mode command and hint', () => {
    const { definition } = fakeContext()
    expect(definition.name).toBe(PLAN_X_COMMAND)
    expect(definition.description).toBe('Enter or leave Plan-X mode')
    expect(definition.input).toEqual({ hint: '[on|off]' })
  })

  it('enters Plan-X from an empty argument', () => {
    const { definition, planMode } = fakeContext()
    expect(invoke(definition, '')).toMatchObject({ kind: 'success' })
    expect(planMode.set).toHaveBeenCalledWith(expect.anything(), false)
  })

  it('enters Plan-X from on and retires built-in plan mode', () => {
    const { definition, planMode } = fakeContext()
    expect(invoke(definition, ' on ')).toMatchObject({ kind: 'success' })
    expect(planMode.set).toHaveBeenCalledWith(expect.anything(), false)
  })

  it('leaves Plan-X from off without touching built-in plan mode', () => {
    const { definition, planMode } = fakeContext()
    expect(invoke(definition, 'off')).toMatchObject({ kind: 'success', text: 'Plan-X mode off.' })
    expect(planMode.set).not.toHaveBeenCalled()
  })

  it('rejects another argument', () => {
    const { definition, planMode } = fakeContext()
    expect(invoke(definition, 'toggle')).toMatchObject({ kind: 'error' })
    expect(planMode.set).not.toHaveBeenCalled()
  })

  it('still works when the built-in plan controller is absent', () => {
    const { definition } = fakeContext(false)
    expect(invoke(definition, 'on')).toMatchObject({ kind: 'success' })
  })
})
