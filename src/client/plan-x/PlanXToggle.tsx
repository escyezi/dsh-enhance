/**
 * Composer Plan-X toggle. It mirrors the projection's committed mode (not local
 * optimism) and executes the same `/plan-x on|off` command a typed invocation
 * uses.
 *
 * @module
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `conversation.input.left` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PlanXProjection } from '../../plan-x/types.ts'
import { NS } from '../locales.ts'
import css from './PlanX.module.css'

/** Operations the toggle's registrant injects. */
export interface PlanXToggleInjected {
  /**
   * Select the committed Plan-X mode.
   * @param active - desired mode.
   * @returns null on admitted execution, otherwise a user-visible failure line.
   */
  setActive: (active: boolean) => Promise<string | null>
}

/** Full props of the composer toggle. */
export type PlanXToggleProps =
  PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS> & InjectFace<PlanXToggleInjected>

/** A small document-and-spark mark, filled on the active state. */
function ToggleGlyph({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M3.25 1.75h6l3.5 3.5v8.5a.75.75 0 0 1-.75.75h-8.75a.75.75 0 0 1-.75-.75v-11.25a.75.75 0 0 1 .75-.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path d="M9 1.9v3.1h3.1" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      <path d="M7.9 6.9l.75 2.05 2.05.75-2.05.75-.75 2.05-.75-2.05-2.05-.75 2.05-.75Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Render the Plan-X toggle.
 * @param props - projection reader, the command operation, and localized copy.
 * @returns the toggle, with a compact failure status when a switch fails.
 */
export function PlanXToggle({ useProjection, setActive, t }: PlanXToggleProps): ReactNode {
  const planX: PlanXProjection | undefined = useProjection('planX')
  const active = planX?.active === true
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const toggle = (): void => {
    setChanging(true)
    setError(null)
    void setActive(!active).then((failure) => {
      if (!aliveRef.current) return
      setChanging(false)
      setError(failure)
    }, (reason: unknown) => {
      if (!aliveRef.current) return
      setChanging(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <span className={css.toggleWrap}>
      <button
        type="button"
        className={css.toggle}
        data-active={active}
        aria-pressed={active}
        aria-label={t(active ? 'planX.toggleOff' : 'planX.toggleOn')}
        title={t(active ? 'planX.toggleOff' : 'planX.toggleOn')}
        disabled={changing}
        onClick={toggle}
      >
        <ToggleGlyph className={css.glyph} />
        <span className={css.toggleLabel}>{t('planX.toggle')}</span>
      </button>
      {error !== null && <span className={css.error} role="status" title={error}>{t('planX.toggleFailed')}</span>}
    </span>
  )
}
