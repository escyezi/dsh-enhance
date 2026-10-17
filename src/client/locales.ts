/**
 * Copy of DSH增强's visible text. Every product string the components render
 * lives here; placeholders are `{name}` substitutions.
 *
 * @module
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by this plugin. */
export const NS = 'escyezi.enhance'

/** Chinese dictionary; its key set is the namespace's key type. */
export const zh = {
  'balance.label': '可用余额',
  'balance.recharged': '充值余额',
  'balance.bonus': '赠金',
  'balance.tooltip': '可用余额 {total}（充值 {recharged} · 赠金 {bonus}）· 点击刷新',
  'balance.tooltipNoBonus': '可用余额 {total}（充值 {recharged}）· 点击刷新',
  'balance.failed': '余额不可用',
  'balance.failedTooltip': '暂时读不到余额，点击重试',
  'planX.toggle': 'Plan-X',
  'planX.toggleOn': '开启 Plan-X 模式',
  'planX.toggleOff': '关闭 Plan-X 模式',
  'planX.toggleFailed': 'Plan-X 模式切换失败',
  'planX.build': 'Build',
  'planX.building': '执行中…',
  'planX.buildAria': '按当前计划开始执行',
  'planX.buildFailed': '执行失败',
  'planX.inactive': '当前会话未激活',
} as const

/** Key set of the `escyezi.enhance` namespace. */
export type EnhanceKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en: Record<EnhanceKey, string> = {
  'balance.label': 'Available',
  'balance.recharged': 'Topped-up balance',
  'balance.bonus': 'Granted',
  'balance.tooltip': 'Available balance {total} (topped-up {recharged} · granted {bonus}) · click to refresh',
  'balance.tooltipNoBonus': 'Available balance {total} (topped-up {recharged}) · click to refresh',
  'balance.failed': 'Balance unavailable',
  'balance.failedTooltip': 'Could not read the balance. Click to retry.',
  'planX.toggle': 'Plan-X',
  'planX.toggleOn': 'Turn on Plan-X mode',
  'planX.toggleOff': 'Turn off Plan-X mode',
  'planX.toggleFailed': 'Could not switch Plan-X mode',
  'planX.build': 'Build',
  'planX.building': 'Building…',
  'planX.buildAria': 'Build this plan',
  'planX.buildFailed': 'Build failed',
  'planX.inactive': 'The session is not active.',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'escyezi.enhance': EnhanceKey
  }
}
