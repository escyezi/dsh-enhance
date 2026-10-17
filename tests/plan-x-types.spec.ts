import { describe, expect, it } from 'vitest'
import { PLAN_DIRECTORY, PLAN_SUFFIX, isPlanPath, normalizePlanPath, planRelativePath } from '../packages/plan-x/src/types.ts'

describe('Plan-X path rules', () => {
  it('normalizes a workspace-relative plan path', () => {
    expect(normalizePlanPath(`${PLAN_DIRECTORY}/add-dark-mode${PLAN_SUFFIX}`))
      .toBe(`${PLAN_DIRECTORY}/add-dark-mode${PLAN_SUFFIX}`)
    expect(normalizePlanPath(`./${PLAN_DIRECTORY}/ui/dark-mode${PLAN_SUFFIX}`))
      .toBe(`${PLAN_DIRECTORY}/ui/dark-mode${PLAN_SUFFIX}`)
    expect(normalizePlanPath(`.dsh\\plans\\add-dark-mode.plan.md`))
      .toBe(`${PLAN_DIRECTORY}/add-dark-mode${PLAN_SUFFIX}`)
  })

  it('rejects paths outside the plan directory or with another suffix', () => {
    for (const path of [
      'plans/add-dark-mode.plan.md',
      '.dsh/plans/add-dark-mode.md',
      '.dsh/plans/../escape.plan.md',
      '.dsh/plans/.plan.md',
      '/tmp/.dsh/plans/absolute.plan.md',
      '',
    ]) {
      expect(normalizePlanPath(path)).toBeUndefined()
    }
  })

  it('accepts nested documents under the plan directory', () => {
    expect(isPlanPath(`${PLAN_DIRECTORY}/ui/dark-mode${PLAN_SUFFIX}`)).toBe(true)
    expect(isPlanPath(`${PLAN_DIRECTORY}/dark-mode${PLAN_SUFFIX}`)).toBe(true)
    expect(isPlanPath(`.dsh/plans//double${PLAN_SUFFIX}`)).toBe(false)
  })

  it('extracts a plan path from a document tab absolute path', () => {
    expect(planRelativePath(`/repo/project/${PLAN_DIRECTORY}/dark-mode${PLAN_SUFFIX}`))
      .toBe(`${PLAN_DIRECTORY}/dark-mode${PLAN_SUFFIX}`)
    expect(planRelativePath(`C:\\repo\\project\\.dsh\\plans\\dark-mode${PLAN_SUFFIX}`))
      .toBe(`${PLAN_DIRECTORY}/dark-mode${PLAN_SUFFIX}`)
    expect(planRelativePath('/repo/project/notes.md')).toBeUndefined()
    expect(planRelativePath(`/repo/project/${PLAN_DIRECTORY}/notes.md`)).toBeUndefined()
  })
})
