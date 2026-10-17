/**
 * Deployment configuration validation for the Host half. The row's `config`
 * object is validated here rather than through a Cordis `Config` schema, so the
 * plugin carries no Schemastery runtime dependency of its own.
 *
 * @module
 */
import { z } from 'zod'
import type { EnhanceConfig } from './types.ts'

const configSchema = z.object({
  balanceRefreshMs: z.number().int().nonnegative(),
}).strict()

/**
 * Validate one row's configuration.
 * @param value - raw configuration object handed to the Host half.
 * @returns the validated configuration.
 * @throws Error naming every invalid field, so a misconfigured row fails at load.
 */
export function parseEnhanceConfig(value: unknown): EnhanceConfig {
  const parsed = configSchema.safeParse(value)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.length === 0 ? '(root)' : issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`dsh-enhance: invalid plugin config (${issues})`)
  }
  return parsed.data
}
