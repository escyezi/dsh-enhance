/**
 * Copy of the balance feature's visible text. Every product string the
 * components render lives here; placeholders are `{name}` substitutions.
 *
 * @module
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by the balance feature. */
export const NS = 'escyezi.enhance.balance'

/** Chinese dictionary; its key set is the namespace's key type. */
export const zh = {
  'balance.label': '可用余额',
  'balance.recharged': '充值余额',
  'balance.bonus': '赠金',
  'balance.tooltip': '可用余额 {total}（充值 {recharged} · 赠金 {bonus}）· 点击刷新',
  'balance.tooltipNoBonus': '可用余额 {total}（充值 {recharged}）· 点击刷新',
  'balance.failed': '余额不可用',
  'balance.failedTooltip': '暂时读不到余额，点击重试',
} as const

/** Key set of the `escyezi.enhance.balance` namespace. */
export type BalanceKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en: Record<BalanceKey, string> = {
  'balance.label': 'Available',
  'balance.recharged': 'Topped-up balance',
  'balance.bonus': 'Granted',
  'balance.tooltip': 'Available balance {total} (topped-up {recharged} · granted {bonus}) · click to refresh',
  'balance.tooltipNoBonus': 'Available balance {total} (topped-up {recharged}) · click to refresh',
  'balance.failed': 'Balance unavailable',
  'balance.failedTooltip': 'Could not read the balance. Click to retry.',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'escyezi.enhance.balance': BalanceKey
  }
}
