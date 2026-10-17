/**
 * The Plan-X session projection: the logged `/plan-x` command lifecycle and the
 * latest `plan_x_write` result, folded into the small value the browser uses for
 * the mode chip and document auto-open.
 *
 * No new session event type is needed: commands already record `command/run`
 * and `command/done`, and the tool result carries its path in the tool-private
 * `meta` payload. Resume and fork therefore rebuild the same state from the log.
 *
 * @module
 */
import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { PlanXDocument, PlanXUnitState } from './types.ts'
import { isPlanPath } from './types.ts'

const documentSchema = z.object({
  path: z.string(),
  revision: z.number().int().nonnegative(),
}).strict()

const stateSchema = z.object({
  active: z.boolean(),
  running: z.object({
    commandId: z.string(),
    wanted: z.boolean(),
  }).strict().nullable(),
  document: documentSchema.nullable(),
}).strict()

/**
 * Read the path out of a plan tool result's presentation metadata.
 * @param meta - opaque `tool/result` metadata.
 * @returns the validated document path, or undefined for another tool result.
 */
function planDocumentPath(meta: unknown): string | undefined {
  if (typeof meta !== 'object' || meta === null) return undefined
  const record = meta as Record<string, unknown>
  if (record['kind'] !== 'plan-x-document') return undefined
  const path = record['path']
  return typeof path === 'string' && isPlanPath(path) ? path : undefined
}

/** The Plan-X session projection unit. */
export const planXProjectionDefinition = {
  key: 'planX',
  stateVersion: 1,
  stateSchema,
  init: (): PlanXUnitState => ({ active: false, running: null, document: null }),
  apply: (state, event) => {
    if (event.type === 'command/run' && event.data.name === 'plan-x') {
      const argument = (event.data.args ?? '').trim()
      if (argument !== '' && argument !== 'on' && argument !== 'off') return state
      return {
        ...state,
        running: { commandId: event.data.commandId as string, wanted: argument !== 'off' },
      }
    }
    if (event.type === 'command/done' && state.running !== null
      && (event.data.commandId as string) === state.running.commandId) {
      if (event.data.kind === 'success') {
        return { ...state, active: state.running.wanted, running: null }
      }
      return { ...state, running: null }
    }
    if (event.type === 'tool/result') {
      const path = planDocumentPath(event.data.meta)
      if (path !== undefined) {
        const document: PlanXDocument = { path, revision: (state.document?.revision ?? 0) + 1 }
        return { ...state, document }
      }
    }
    return state
  },
  wire: {
    viewSchema: z.object({
      active: z.boolean(),
      document: documentSchema.nullable(),
    }).strict(),
    view: (state) => ({ active: state.active, document: state.document }),
  },
} satisfies ProjectionDefinition<'planX', PlanXUnitState>
