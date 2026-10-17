/**
 * Host half of the balance feature: validates the row's configuration and
 * republishes the display values the browser half needs.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { BalanceClientConfig, BalanceConfig } from './types.ts'
import { BALANCE_CONFIG_GLOBAL } from './client-config.ts'
import { parseBalanceConfig } from './config.ts'

/** Cordis plugin name. */
export const name = 'dsh-enhance-balance'

/**
 * Publish the browser half's configuration.
 *
 * @param ctx - registrant context carrying the web server.
 * @param config - the row's `config`, validated here.
 * @throws Error when the row's configuration is invalid.
 */
export function apply(ctx: Context, config: unknown): void {
  const parsed: BalanceConfig = parseBalanceConfig(config)
  const published: BalanceClientConfig = { balanceRefreshMs: parsed.balanceRefreshMs }
  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'global',
      name: BALANCE_CONFIG_GLOBAL,
      value: published,
    })
  })
}
