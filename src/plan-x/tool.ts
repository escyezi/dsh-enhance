/**
 * The `plan_x_write` tool: creates or replaces one Markdown plan document in
 * the workspace's `.dsh/plans/` directory without approval and without ending
 * the turn. Its result carries the document path in `presentationMeta`, which
 * the session projection turns into the client's auto-open signal.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolResult, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-plan-mode'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-working-directory'
import { PLAN_DIRECTORY, PLAN_SUFFIX, normalizePlanPath } from './types.ts'

/** Model-facing tool name. */
export const PLAN_X_TOOL = 'plan_x_write'

interface PlanWriteArgs {
  path: string
  markdown: string
}

interface PlanWriteValue {
  path: string
  title: string
  operation: 'created' | 'updated'
}

const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: {
      type: 'string',
      description: `Workspace-relative path under ${PLAN_DIRECTORY}/, ending in ${PLAN_SUFFIX}. `
        + 'Reuse the existing path to revise that plan; choose a new descriptive kebab-case path for a new plan.',
    },
    markdown: {
      type: 'string',
      description: 'Complete revised plan as Markdown, starting with a # heading that names the plan.',
    },
  },
  required: ['path', 'markdown'],
} as const

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    path: { type: 'string' as const },
    title: { type: 'string' as const },
    operation: { type: 'string' as const },
  },
  required: ['path', 'title', 'operation'],
}

const TOOL_DESCRIPTION
  = 'Create or replace one Plan-X Markdown plan document under .dsh/plans/. '
  + 'Use it for every plan creation and every revision; writing a plan never starts implementation '
  + 'and never requires approval. Only available while Plan-X mode is active.'

/** Read and validate the model's arguments before touching the filesystem. */
function readArgs(args: unknown): PlanWriteArgs {
  if (typeof args !== 'object' || args === null) {
    throw new Error(`${PLAN_X_TOOL}: arguments must be an object`)
  }
  const record = args as Record<string, unknown>
  const path = record['path']
  const markdown = record['markdown']
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error(`${PLAN_X_TOOL}: "path" must be a non-empty string`)
  }
  if (typeof markdown !== 'string') {
    throw new Error(`${PLAN_X_TOOL}: "markdown" must be a string`)
  }
  return { path, markdown }
}

/** The plan's first Markdown heading (any level), or undefined when it has none. */
function firstHeading(markdown: string): string | undefined {
  for (const line of markdown.split('\n')) {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(line)
    if (match !== null) return match[1]
  }
  return undefined
}

/** Read a partial call safely; pending presentation must never throw. */
function headingOfPending(args: unknown): { title: string; markdown: string } {
  if (typeof args !== 'object' || args === null) return { title: 'Plan-X', markdown: '' }
  const markdown = (args as Record<string, unknown>)['markdown']
  if (typeof markdown !== 'string') return { title: 'Plan-X', markdown: '' }
  return { title: firstHeading(markdown) ?? 'Plan-X', markdown }
}

/**
 * Build the Plan-X tool definition.
 * @param ctx - context carrying fs, working-directory, tools, and projections.
 * @returns the definition to register.
 */
export function planWriteDefinition(ctx: Context): ToolDefinition {
  return {
    name: PLAN_X_TOOL,
    description: TOOL_DESCRIPTION,
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as unknown as PlanWriteValue
        const verb = result.operation === 'created' ? 'Created' : 'Updated'
        return [{
          type: 'text' as const,
          text: `${verb} Plan-X document ${result.path}: ${result.title}. The document preview opens automatically; use its Build button when the plan is ready.`,
        }]
      },
      presentationMeta: (_args, value) => {
        const result = value as unknown as PlanWriteValue
        return { kind: 'plan-x-document', path: result.path }
      },
    },
    execute: async (args: unknown, exec: ToolRunContext): Promise<PlanWriteValue> => {
      const input = readArgs(args)
      const agent = exec.agent
      if (agent === undefined) throw new Error(`${PLAN_X_TOOL} requires a calling agent`)
      if (ctx.sessionProjections.stateOf(agent.session, 'planX')?.active !== true) {
        throw new Error(`${PLAN_X_TOOL} is only available while Plan-X mode is active`)
      }
      if (ctx.sessionProjections.stateOf(agent.session, 'plan')?.active === true) {
        throw new Error(`${PLAN_X_TOOL} is unavailable while the built-in plan mode is active`)
      }
      const path = normalizePlanPath(input.path)
      if (path === undefined) {
        throw new Error(`${PLAN_X_TOOL}: path must be a workspace-relative ${PLAN_DIRECTORY}/…${PLAN_SUFFIX} path`)
      }
      const title = firstHeading(input.markdown)
      if (title === undefined) {
        throw new Error(`${PLAN_X_TOOL}: markdown must start with a # heading that names the plan`)
      }
      const cwd = await ctx.workingDirectory.ensure(agent, exec.signal)
      if (cwd === undefined) throw new Error(`${PLAN_X_TOOL}: the session has no workspace directory`)

      // Refuse a symlinked plan directory or final file: the plan tool writes
      // through the fs provider's own target resolution, and a repository-owned
      // link must not redirect it outside the workspace.
      const directory = await ctx.fs.lstat(PLAN_DIRECTORY, { cwd }, exec.signal)
      if (directory?.type === 'symlink') {
        throw new Error(`${PLAN_X_TOOL}: refusing to write through a symlinked ${PLAN_DIRECTORY} directory`)
      }
      const directoryTarget = await ctx.fs.resolve(PLAN_DIRECTORY, { cwd, signal: exec.signal })
      const target = await ctx.fs.resolve(path, { cwd, signal: exec.signal })
      if (!ctx.fs.contains(directoryTarget, target)) {
        throw new Error(`${PLAN_X_TOOL}: path escapes ${PLAN_DIRECTORY}`)
      }
      const file = await ctx.fs.lstat(path, { cwd }, exec.signal)
      if (file?.type === 'symlink') {
        throw new Error(`${PLAN_X_TOOL}: refusing to write through a symlink`)
      }

      const outcome = await ctx.fs.writeText(target, input.markdown, undefined, exec.signal)
      return {
        path,
        title,
        operation: outcome.operation === 'create' ? 'created' : 'updated',
      }
    },
    presentCall: (args) => {
      const pending = headingOfPending(args)
      return {
        card: 'generic',
        title: pending.title,
        kind: 'other',
        content: pending.markdown === '' ? [] : [{ type: 'text' as const, text: pending.markdown }],
      }
    },
    presentResult: (_args, result: ToolResult) => ({
      card: 'generic',
      title: 'Plan-X document',
      content: result.content,
    }),
  } satisfies ToolDefinition
}

/**
 * Register the Plan-X tool.
 * @param ctx - context carrying fs, working-directory, tools, and projections.
 * @returns the tool registration disposer.
 */
export function registerPlanXTool(ctx: Context): () => void {
  return ctx.tools.register(planWriteDefinition(ctx))
}
