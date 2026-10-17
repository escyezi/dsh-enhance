/**
 * Headless auto-open: when the Plan-X projection reports a new document
 * revision, reveal that Markdown file in the right Sidebar's document preview.
 * It mounts with the composer, so a document already present on mount is
 * historical and is not reopened.
 *
 * @module
 */
import { useEffect, useRef } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `conversation.input.overlay` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PlanXProjection } from '../types.ts'

/** Operations the auto-open registration injects. */
export interface PlanXAutoOpenInjected {
  /**
   * Reveal one workspace-relative plan document.
   * @param path - `.dsh/plans/…` path recorded by the Host projection.
   */
  openDocument: (path: string) => void
}

/** Full props of the headless auto-open entry. */
export type PlanXAutoOpenProps =
  PropsRuntime<'conversation.input.overlay'> & InjectFace<PlanXAutoOpenInjected>

/**
 * Watch the Plan-X projection and open each newly written document.
 * @param props - projection reader and the reveal operation.
 * @returns nothing; the entry exists only for its effect.
 */
export function PlanXAutoOpen({ useProjection, openDocument }: PlanXAutoOpenProps): null {
  const planX: PlanXProjection | undefined = useProjection('planX')
  const document = planX?.document
  const revision = document?.revision
  const path = document?.path
  // The first render's revision is the baseline: a restored session's latest
  // plan is not a fresh write, so only a later revision should open.
  const seenRef = useRef<number | undefined>(revision)

  useEffect(() => {
    if (revision === undefined || path === undefined) return
    if (seenRef.current === revision) return
    seenRef.current = revision
    openDocument(path)
  }, [revision, path, openDocument])

  return null
}
