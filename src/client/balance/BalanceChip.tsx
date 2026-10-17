/**
 * Sidebar-foot balance card showing the signed-in account's available balance
 * with its topped-up and granted parts. It sits above the settings/account row,
 * hides while signed out, and re-reads on click.
 *
 * The hover/focus hint is the native `title` tooltip rather than a Harness UI
 * package: this plugin keeps its only runtime dependencies to React, Cordis, and
 * the slot registry, so a host-primitives change cannot blank the slot entry.
 *
 * @module
 */
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: declares the `sidebar.footer.action` slot this component occupies.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { BalanceSnapshot } from './balance-source.ts'
import { currencySymbol, formatMicro } from './money.ts'
import { NS } from '../locales.ts'
import css from './BalanceChip.module.css'

/** What the chip's registrant injects. */
export interface BalanceChipInjected {
  /** Read the balance now. */
  refresh: () => Promise<void>
  /** Live balance snapshot plus its theme-shared seat. */
  hooks: { balance: HostObservable<BalanceSnapshot> }
}

/** Chip props: sidebar-foot owner share, injected operations, and locale. */
export type BalanceChipProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<typeof NS> & InjectFace<BalanceChipInjected>

/** A small outline warning mark owned by this component. */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 1.75a1.1 1.1 0 0 1 .95.55l6.1 10.6a1.1 1.1 0 0 1-.95 1.65H1.9a1.1 1.1 0 0 1-.95-1.65l6.1-10.6A1.1 1.1 0 0 1 8 1.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M8 5.5v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r=".85" fill="currentColor" />
    </svg>
  )
}

/**
 * @param props - sidebar geometry, the injected balance seat, and the locale seat.
 * @returns the balance card, or null while signed out or still loading its first read.
 */
export function BalanceChip({ wide, useBalance, refresh, t }: BalanceChipProps) {
  const snapshot = useBalance((value: BalanceSnapshot) => value)
  if (snapshot.status === 'signed-out' || snapshot.status === 'loading') return null

  if (snapshot.status === 'failed') {
    const label = t('balance.failedTooltip')
    return (
      <button
        type="button"
        className={wide ? css.card : css.railChip}
        data-enhance-balance="failed"
        title={label}
        aria-label={label}
        onClick={() => { void refresh() }}
      >
        <span className={css.totalRow}>
          <WarningIcon className={css.icon} />
          {wide && <span className={css.label}>{t('balance.failed')}</span>}
        </span>
      </button>
    )
  }

  const total = formatMicro(snapshot.totalMicro, snapshot.currency)
  const recharged = formatMicro(snapshot.rechargedMicro, snapshot.currency)
  const bonus = formatMicro(snapshot.bonusMicro, snapshot.currency)
  // A spent bonus is not a figure worth showing; it only survives in the copy.
  const hasBonus = snapshot.bonusMicro > 0
  const tooltip = hasBonus
    ? t('balance.tooltip', { total, recharged, bonus })
    : t('balance.tooltipNoBonus', { total, recharged })

  // The collapsed rail has no room for the figures; the tooltip carries them.
  if (!wide) {
    return (
      <button
        type="button"
        className={css.railChip}
        data-enhance-balance="ready"
        title={tooltip}
        aria-label={tooltip}
        onClick={() => { void refresh() }}
      >
        {currencySymbol(snapshot.currency)}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={css.card}
      data-enhance-balance="ready"
      title={tooltip}
      aria-label={tooltip}
      onClick={() => { void refresh() }}
    >
      <span className={css.amountRow}>
        <span className={css.label}>{t('balance.recharged')}</span>
        <span className={css.amount}>{recharged}</span>
      </span>
      {hasBonus && (
        <span className={css.bonusRow}>
          <span className={css.bonusLabel}>{t('balance.bonus')}</span>
          <span className={css.bonusValue}>{bonus}</span>
        </span>
      )}
    </button>
  )
}
