import { describe, expect, it } from 'vitest'
import { planXProjectionDefinition } from '../packages/plan-x/src/projection.ts'
import type { PlanXUnitState } from '../packages/plan-x/src/types.ts'

type Apply = (state: PlanXUnitState, event: unknown) => PlanXUnitState
const apply = planXProjectionDefinition.apply as unknown as Apply

function initial(): PlanXUnitState {
  return planXProjectionDefinition.init()
}

function run(commandId: string, args: string | undefined) {
  return { type: 'command/run', data: { commandId, name: 'plan-x', args, source: { kind: 'user' } } }
}

function done(commandId: string, kind: 'success' | 'error') {
  return { type: 'command/done', data: { commandId, kind } }
}

function toolResult(meta: unknown) {
  return { type: 'tool/result', data: { meta } }
}

describe('Plan-X projection', () => {
  it('starts inactive with no document', () => {
    expect(initial()).toEqual({ active: false, running: null, document: null })
  })

  it('commits Plan-X on after a successful command', () => {
    const running = apply(initial(), run('c1', ' on '))
    expect(running.running).toEqual({ commandId: 'c1', wanted: true })
    const settled = apply(running, done('c1', 'success'))
    expect(settled).toMatchObject({ active: true, running: null })
  })

  it('commits Plan-X off after a successful command', () => {
    const active = { ...initial(), active: true }
    const running = apply(active, run('c2', 'off'))
    expect(running.running).toEqual({ commandId: 'c2', wanted: false })
    expect(apply(running, done('c2', 'success'))).toMatchObject({ active: false, running: null })
  })

  it('keeps the committed mode when the command fails', () => {
    const active = { ...initial(), active: true }
    const running = apply(active, run('c3', 'off'))
    expect(apply(running, done('c3', 'error'))).toMatchObject({ active: true, running: null })
  })

  it('ignores an invalid argument and another command settlement', () => {
    const state = apply(initial(), run('c4', 'maybe'))
    expect(state.running).toBeNull()
    const running = apply(initial(), run('c5', 'on'))
    expect(apply(running, done('other', 'success'))).toEqual(running)
  })

  it('records each plan tool result as a new document revision', () => {
    const first = apply(initial(), toolResult({ kind: 'plan-x-document', path: '.dsh/plans/a.plan.md' }))
    expect(first.document).toEqual({ path: '.dsh/plans/a.plan.md', revision: 1 })
    const second = apply(first, toolResult({ kind: 'plan-x-document', path: '.dsh/plans/b.plan.md' }))
    expect(second.document).toEqual({ path: '.dsh/plans/b.plan.md', revision: 2 })
  })

  it('ignores tool results from other tools or invalid paths', () => {
    const state = initial()
    expect(apply(state, toolResult({ kind: 'other', path: '.dsh/plans/a.plan.md' }))).toBe(state)
    expect(apply(state, toolResult({ kind: 'plan-x-document', path: 'notes.md' }))).toBe(state)
    expect(apply(state, toolResult({ kind: 'plan-x-document' }))).toBe(state)
  })
})
