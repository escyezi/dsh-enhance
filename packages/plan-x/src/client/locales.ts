/**
 * Copy of the Plan-X feature's visible text. Every product string the
 * components render lives here; placeholders are `{name}` substitutions.
 *
 * @module
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by the Plan-X feature. */
export const NS = 'escyezi.enhance.planX'

/** Chinese dictionary; its key set is the namespace's key type. */
export const zh = {
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

/** Key set of the `escyezi.enhance.planX` namespace. */
export type PlanXKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en: Record<PlanXKey, string> = {
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
    'escyezi.enhance.planX': PlanXKey
  }
}
