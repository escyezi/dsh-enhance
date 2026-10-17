import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { PLAN_X_POLICY_SECTION, registerPlanXPolicy } from '../packages/plan-x/src/policy.ts'

interface Section {
  name: string
  order: number
  text: (context: never) => string
}

function fakeContext(planX: boolean, plan: boolean): Section {
  let section: Section | undefined
  const ctx = {
    systemPrompt: {
      getSectionOrder: () => 500,
      section: (value: Section) => {
        section = value
        return () => {}
      },
    },
    sessionProjections: {
      stateOf: (_session: unknown, key: string) => {
        if (key === 'planX') return { active: planX }
        if (key === 'plan') return { active: plan }
        return undefined
      },
    },
  } as unknown as Context
  registerPlanXPolicy(ctx)
  if (section === undefined) throw new Error('policy section was not registered')
  return section
}

const CONTEXT = { agent: { session: {} } } as never

describe('Plan-X policy section', () => {
  it('renders the plan-file guidance only in Plan-X mode', () => {
    const section = fakeContext(true, false)
    expect(section.name).toBe(PLAN_X_POLICY_SECTION)
    expect(section.order).toBe(500)
    const text = section.text(CONTEXT)
    expect(text).toContain('.dsh/plans/')
    expect(text).toContain('plan_x_write')
    expect(text).toContain('Build button')
    expect(text).toContain('Do not ask for approval')
    expect(text).toContain('ask_user_question')
    expect(text).toContain('unclear or ambiguous')
    expect(text).toContain('before finalizing')
    expect(text).toContain('Clarifying questions are not approval requests')
  })

  it('renders nothing outside Plan-X mode', () => {
    expect(fakeContext(false, false).text(CONTEXT)).toBe('')
  })

  it('yields to the built-in plan mode', () => {
    expect(fakeContext(true, true).text(CONTEXT)).toBe('')
  })

  it('renders nothing without an agent', () => {
    expect(fakeContext(true, false).text({} as never)).toBe('')
  })
})
