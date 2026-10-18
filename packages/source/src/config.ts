/**
 * Configuration of the source-reference row.
 *
 * The schema is native Schemastery so the Plugins page can supply the row's
 * configuration form. The path is volatile: saving it applies without a Host
 * plugin reload, and every prompt assembly reads the latest value.
 *
 * @module
 */
import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Configuration of the source-reference row. */
export interface Config {
  /** Absolute path to a local DeepSeek Harness source checkout; empty means unset. */
  sourcePath: Volatile<string>
}

/** Native Schemastery schema; the Plugins page uses it to build the row form. */
export const Config = z.object({
  sourcePath: z.string()
    .default('')
    .volatile()
    .description('Absolute path to a local DeepSeek Harness source checkout.'),
})
