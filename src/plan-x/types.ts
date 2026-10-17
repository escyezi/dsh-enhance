/**
 * Shared vocabulary of Plan-X, the planning mode that keeps plans as ordinary
 * Markdown files and lets the user start implementation from the document's
 * Build button.
 *
 * This module is safe for both halves: it has no runtime imports, and the
 * projection key declaration below is the one place that names the session
 * projections Plan-X owns.
 *
 * @module
 */

/** Workspace-relative directory holding Plan-X documents. */
export const PLAN_DIRECTORY = '.dsh/plans'

/** Suffix every Plan-X document carries. */
export const PLAN_SUFFIX = '.plan.md'

/** One plan document the current session has written or revised. */
export interface PlanXDocument {
  /** Workspace-relative path under {@link PLAN_DIRECTORY}. */
  path: string
  /** Monotonic revision counter; the client opens a document when this changes. */
  revision: number
}

/** Client-visible Plan-X state. */
export interface PlanXProjection {
  /** Whether Plan-X mode is in force. */
  active: boolean
  /** The latest plan document written in this session, if any. */
  document: PlanXDocument | null
}

/** Host fold state used to derive {@link PlanXProjection}. */
export interface PlanXUnitState {
  /** Logged Plan-X mode. */
  active: boolean
  /** The latest `/plan-x` command awaiting its paired settlement. */
  running: { commandId: string; wanted: boolean } | null
  /** The latest document reported by a successful `plan_x_write` result. */
  document: PlanXDocument | null
}

/**
 * Normalize a model-supplied plan path.
 * @param input - path as the model supplied it.
 * @returns the normalized workspace-relative path, or undefined when it does
 *   not name a Plan-X document under {@link PLAN_DIRECTORY}.
 */
export function normalizePlanPath(input: string): string | undefined {
  const normalized = input.trim().replaceAll('\\', '/').replace(/^(?:\.\/)+/, '')
  return isPlanPath(normalized) ? normalized : undefined
}

/**
 * Whether a path names a document under the Plan-X directory.
 * @param path - candidate path with either separator spelling.
 * @returns true for `.dsh/plans/**\/*.plan.md` without empty or traversal segments.
 */
export function isPlanPath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/')
  if (!normalized.startsWith(`${PLAN_DIRECTORY}/`)) return false
  if (!normalized.endsWith(PLAN_SUFFIX)) return false
  return !normalized.split('/').some(segment =>
    segment === '' || segment === '.' || segment === '..' || segment === PLAN_SUFFIX)
}

/**
 * Extract the Plan-X document path from an absolute path in a document tab.
 * @param absolutePath - absolute path the document preview reports.
 * @returns the workspace-relative `.dsh/plans/…` path, or undefined for any
 *   other file.
 */
export function planRelativePath(absolutePath: string): string | undefined {
  const normalized = absolutePath.replaceAll('\\', '/')
  const marker = `/${PLAN_DIRECTORY}/`
  const index = normalized.lastIndexOf(marker)
  if (index < 0) return undefined
  const relative = normalized.slice(index + 1)
  return isPlanPath(relative) ? relative : undefined
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Host Plan-X fold state. */
    planX: PlanXUnitState
  }
  interface SessionProjectionMap {
    /** Plan-X mode and the latest plan document written in the session. */
    planX: PlanXProjection
  }
}
