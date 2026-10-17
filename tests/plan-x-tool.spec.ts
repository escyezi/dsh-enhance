import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { PLAN_X_TOOL, planWriteDefinition } from '../packages/plan-x/src/tool.ts'

interface WriteCall {
  target: unknown
  content: string
  policy: unknown
}

interface Options {
  planX?: boolean
  plan?: boolean
  dirSymlink?: boolean
  fileSymlink?: boolean
  operation?: 'create' | 'update'
  sandboxPolicy?: boolean
}

function fakeContext(options: Options = {}): { ctx: Context; writes: WriteCall[] } {
  const writes: WriteCall[] = []
  const ctx = {
    sessionProjections: {
      stateOf: (_session: unknown, key: string) => {
        if (key === 'planX') return { active: options.planX ?? true }
        if (key === 'plan') return { active: options.plan ?? false }
        return undefined
      },
    },
    workingDirectory: { ensure: async () => '/workspace' },
    get: (key: string) => key === 'sandboxPolicy' && options.sandboxPolicy !== false
      ? { resolve: () => ({ mode: 'workspace-write', workspaceRoot: '/workspace' }) }
      : undefined,
    fs: {
      lstat: async (path: string) => {
        if (path === '.dsh/plans' && options.dirSymlink === true) return { type: 'symlink' }
        if (path.endsWith('.plan.md') && options.fileSymlink === true) return { type: 'symlink' }
        return undefined
      },
      resolve: async (path: string) => ({ targetKey: path, displayPath: path }),
      contains: (parent: { targetKey: string }, child: { targetKey: string }) =>
        child.targetKey === parent.targetKey || child.targetKey.startsWith(`${parent.targetKey}/`),
      writeText: async (target: unknown, content: string, _expected: unknown, _signal: unknown, policy: unknown) => {
        writes.push({ target, content, policy })
        return { operation: options.operation ?? 'create', version: 'v1', before: null, after: content }
      },
    },
    tools: { register: () => () => {} },
  } as unknown as Context
  return { ctx, writes }
}

const EXEC = { agent: { session: {} }, signal: new AbortController().signal } as never
const MARKDOWN = '# Add dark mode\n\n- Add a preference.\n- Apply it to the shell.'

async function execute(ctx: Context, args: unknown): Promise<unknown> {
  return planWriteDefinition(ctx).execute(args, EXEC)
}

describe('plan_x_write tool', () => {
  it('creates the plan file and reports its path and title', async () => {
    const { ctx, writes } = fakeContext()
    const value = await execute(ctx, { path: '.dsh/plans/dark-mode.plan.md', markdown: MARKDOWN })
    expect(value).toEqual({
      path: '.dsh/plans/dark-mode.plan.md',
      title: 'Add dark mode',
      operation: 'created',
    })
    expect(writes).toEqual([{
      target: { targetKey: '.dsh/plans/dark-mode.plan.md', displayPath: '.dsh/plans/dark-mode.plan.md' },
      content: MARKDOWN,
      policy: { mode: 'workspace-write', workspaceRoot: '/workspace' },
    }])
  })

  it('passes no sandbox policy when the service is absent', async () => {
    const { ctx, writes } = fakeContext({ sandboxPolicy: false })
    await execute(ctx, { path: '.dsh/plans/dark-mode.plan.md', markdown: MARKDOWN })
    expect(writes).toHaveLength(1)
    expect(writes[0].policy).toBeUndefined()
  })

  it('reports an update when the file already existed', async () => {
    const { ctx } = fakeContext({ operation: 'update' })
    await expect(execute(ctx, { path: '.dsh/plans/dark-mode.plan.md', markdown: MARKDOWN }))
      .resolves.toMatchObject({ operation: 'updated' })
  })

  it('is unavailable outside Plan-X mode', async () => {
    const { ctx } = fakeContext({ planX: false })
    await expect(execute(ctx, { path: '.dsh/plans/dark-mode.plan.md', markdown: MARKDOWN }))
      .rejects.toThrow(/only available while Plan-X mode is active/u)
  })

  it('is unavailable while the built-in plan mode is active', async () => {
    const { ctx } = fakeContext({ plan: true })
    await expect(execute(ctx, { path: '.dsh/plans/dark-mode.plan.md', markdown: MARKDOWN }))
      .rejects.toThrow(/built-in plan mode/u)
  })

  it('rejects a path outside the plan directory', async () => {
    const { ctx, writes } = fakeContext()
    await expect(execute(ctx, { path: 'notes.md', markdown: MARKDOWN }))
      .rejects.toThrow(/path must be a workspace-relative/u)
    expect(writes).toHaveLength(0)
  })

  it('rejects a plan without a heading', async () => {
    const { ctx, writes } = fakeContext()
    await expect(execute(ctx, { path: '.dsh/plans/no-title.plan.md', markdown: '- no heading' }))
      .rejects.toThrow(/must start with a # heading/u)
    expect(writes).toHaveLength(0)
  })

  it('refuses a symlinked plan directory', async () => {
    const { ctx, writes } = fakeContext({ dirSymlink: true })
    await expect(execute(ctx, { path: '.dsh/plans/dark-mode.plan.md', markdown: MARKDOWN }))
      .rejects.toThrow(/symlinked .dsh\/plans directory/u)
    expect(writes).toHaveLength(0)
  })

  it('refuses a symlinked plan file', async () => {
    const { ctx, writes } = fakeContext({ fileSymlink: true })
    await expect(execute(ctx, { path: '.dsh/plans/dark-mode.plan.md', markdown: MARKDOWN }))
      .rejects.toThrow(/refusing to write through a symlink/u)
    expect(writes).toHaveLength(0)
  })

  it('exposes the document path for the projection and a safe pending card', () => {
    const { ctx } = fakeContext()
    const definition = planWriteDefinition(ctx)
    expect(definition.name).toBe(PLAN_X_TOOL)
    expect(definition.parameters).toMatchObject({ type: 'object', required: ['path', 'markdown'] })
    expect(definition.output.presentationMeta?.(
      {},
      { path: '.dsh/plans/dark-mode.plan.md', title: 'Add dark mode', operation: 'created' },
    )).toEqual({ kind: 'plan-x-document', path: '.dsh/plans/dark-mode.plan.md' })
    const pending = definition.presentCall?.({ markdown: MARKDOWN })
    expect(pending).toMatchObject({ card: 'generic', title: 'Add dark mode' })
  })
})
