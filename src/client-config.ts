/**
 * The display values the Host republishes for the browser half, and the reader
 * that validates them. This module stays free of runtime dependencies so the
 * client bundle carries no validator library.
 *
 * @module
 */
import type { EnhanceClientConfig } from './types.ts'

/** Global the Host publishes for the browser half. */
export const ENHANCE_CONFIG_GLOBAL = '__DSH_ENHANCE__'

/**
 * Read the browser half's configuration, degrading to "no timer" when the Host
 * published nothing or published something this build cannot read.
 * @param value - the global's raw value.
 * @returns the validated client configuration.
 */
export function readClientConfig(value: unknown): EnhanceClientConfig {
  if (typeof value !== 'object' || value === null) return { balanceRefreshMs: 0 }
  const record = value as Record<string, unknown>
  const interval = record['balanceRefreshMs']
  const balanceRefreshMs = typeof interval === 'number' && Number.isSafeInteger(interval) && interval >= 0 ? interval : 0
  return { balanceRefreshMs }
}
