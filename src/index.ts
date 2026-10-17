/**
 * Host half of DSH增强: republishes the display values the browser half needs.
 *
 * Every future enhancement that needs deployment configuration adds its field
 * here and in `EnhanceClientConfig`, rather than reaching for a second global.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { EnhanceClientConfig, EnhanceConfig } from './types.ts'
import { ENHANCE_CONFIG_GLOBAL } from './client-config.ts'
import { parseEnhanceConfig } from './config.ts'

/** Cordis plugin name. */
export const name = 'dsh-enhance'

/**
 * Publish the browser half's configuration.
 * @param ctx - registrant context carrying the web server.
 * @param config - the row's `config`, validated here.
 * @throws Error when the row's configuration is invalid.
 */
export function apply(ctx: Context, config: unknown): void {
  const parsed: EnhanceConfig = parseEnhanceConfig(config)
  const published: EnhanceClientConfig = { balanceRefreshMs: parsed.balanceRefreshMs }
  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'global',
      name: ENHANCE_CONFIG_GLOBAL,
      value: published,
    })
  })
}
