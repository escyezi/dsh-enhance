/**
 * Composer Plan-X toggle. It mirrors the projection's committed mode (not local
 * optimism) and executes the same `/plan-x on|off` command a typed invocation
 * uses. The control follows the host `Switch` geometry and token mapping: a
 * neutral gray track with a visible thumb when off, the host primary color when
 * on, and no local visual state ahead of the projection.
 *
 * @module
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `conversation.input.left` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PlanXProjection } from '../types.ts'
import { NS } from './locales.ts'
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

/**
 * Render the Plan-X toggle.
 * @param props - projection reader, the command operation, and localized copy.
 * @returns the switch, with a compact failure status when a switch fails.
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
        role="switch"
        className={css.toggle}
        aria-checked={active}
        aria-label={t(active ? 'planX.toggleOff' : 'planX.toggleOn')}
        title={t(active ? 'planX.toggleOff' : 'planX.toggleOn')}
        disabled={changing}
        onClick={toggle}
      >
        <span className={css.toggleLabel}>{t('planX.toggle')}</span>
        <span className={css.track} data-part="track">
          <span className={css.thumb} data-part="thumb" />
        </span>
      </button>
      {error !== null && (
        <span className={css.error} role="status" title={error}>
          {t('planX.toggleFailed')}: {error}
        </span>
      )}
    </span>
  )
}
