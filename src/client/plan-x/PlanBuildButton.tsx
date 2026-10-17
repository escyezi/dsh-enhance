/**
 * Build button in the Markdown document toolbar. It renders only for Plan-X
 * documents and runs the same "leave the mode, send an execution prompt"
 * operation the feature describes.
 *
 * @module
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the document-actions SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import { planRelativePath } from '../../plan-x/types.ts'
import { NS } from '../locales.ts'
import css from './PlanX.module.css'

/** Operations the Build button's registrant injects. */
export interface PlanBuildInjected {
  /**
   * Leave Plan-X and send the execution prompt for one plan document.
   * @param relativePath - workspace-relative `.dsh/plans/…` path.
   * @returns null on a queued prompt, otherwise a user-visible failure line.
   */
  build: (relativePath: string) => Promise<string | null>
}

/** Full props of the document Build action. */
export type PlanBuildButtonProps =
  PropsRuntime<'sidebar.right.tab.document.actions'> & PropsLocale<typeof NS> & InjectFace<PlanBuildInjected>

/** A compact play mark for the Build action. */
function BuildGlyph({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M4.25 2.6a.7.7 0 0 1 1.06-.6l7 5.4a.75.75 0 0 1 0 1.2l-7 5.4a.7.7 0 0 1-1.06-.6V2.6Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Render the plan Build action.
 * @param props - the previewed file path, the build operation, and localized copy.
 * @returns the Build button, or null for a non-plan document.
 */
export function PlanBuildButton({ absolutePath, build, t }: PlanBuildButtonProps): ReactNode {
  const relativePath = planRelativePath(absolutePath)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  if (relativePath === undefined) return null

  const run = (): void => {
    setBuilding(true)
    setError(null)
    void build(relativePath).then((failure) => {
      if (!aliveRef.current) return
      setBuilding(false)
      setError(failure)
    }, (reason: unknown) => {
      if (!aliveRef.current) return
      setBuilding(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const label = building ? t('planX.building') : t('planX.build')
  return (
    <span className={css.buildWrap}>
      <button
        type="button"
        className={css.build}
        aria-label={label}
        title={t('planX.buildAria')}
        disabled={building}
        onClick={run}
      >
        <BuildGlyph className={css.buildGlyph} />
        <span>{label}</span>
      </button>
      {error !== null && (
        <span className={css.buildError} role="status" title={error}>
          {t('planX.buildFailed')}: {error}
        </span>
      )}
    </span>
  )
}
