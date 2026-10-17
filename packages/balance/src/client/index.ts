/**
 * Browser half of the balance feature: the sidebar balance chip over the
 * account Remote. The account capability is optional, so a composition without
 * it simply renders no chip.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: declares `ctx.remote`, the services the Client receives from the Host.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: declares `ctx.slots`, the registry the registrations go through.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: declares the sidebar footer action slot.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { AccountDetails, AccountView } from '@deepseek-ai/dsh-deepseek-account/types'
import { BALANCE_CONFIG_GLOBAL, readBalanceClientConfig } from '../client-config.ts'
import { en, NS, zh } from './locales.ts'
import { createBalanceSource } from './balance-source.ts'
import { BalanceChip, type BalanceChipInjected } from './BalanceChip.tsx'

export { NS }

/** Services the registration needs; the account Remote is optional and injected per registration. */
export const inject = ['slots', 'locale', 'remote'] as const

/**
 * Register the balance chip.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-enhance-balance: dictionaries')
  const clientConfig = readBalanceClientConfig((globalThis as Record<string, unknown>)[BALANCE_CONFIG_GLOBAL])

  // The account Remote is an optional capability: without it the chip is absent.
  ctx.inject(['remote.account'], (scope) => {
    const stream = scope.remote.$stream<AccountView>({
      name: 'account',
      open: (signal: AbortSignal) => scope.remote.account.watch(signal),
      ended: () => new Error('account stream ended'),
    })
    scope.effect(() => () => stream.dispose(), 'dsh-enhance-balance: account stream')
    const balance = createBalanceSource({
      frames: accepted(stream),
      refreshMs: clientConfig.balanceRefreshMs,
      readBalance: async (): Promise<AccountDetails['balance'] | null> => {
        const result = await scope.remote.account.getBalance({
          // The client build embeds its product version; the Host derives the Platform headers from it.
          version: process.env.DSH_CLIENT_VERSION ?? '0.0.0',
          locale: ctx.locale.getSnapshot().active,
          // Date.getTimezoneOffset reports minutes west of UTC; Platform wants seconds east.
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
        })
        if (!result.ok) throw new Error('account balance failed')
        return result.value
      },
    })
    scope.effect(() => () => balance.dispose(), 'dsh-enhance-balance: balance source')
    scope.slots.inject('sidebar.footer.action', () => scope.slots.register({
      name: 'sidebar.footer.action', id: 'balance', order: 0, locale: NS,
      inject: (): BalanceChipInjected => ({ refresh: balance.refresh, hooks: { balance: balance.source } }),
    }, BalanceChip))
  })
}

/**
 * Drive one Remote stream to completion, acknowledging each consumed frame.
 * @param stream - frames of the account state stream.
 * @returns the frames' values as an async iterable.
 */
async function* accepted<T>(stream: AsyncIterable<{ value: T; accept: () => void }>): AsyncIterable<T> {
  for await (const frame of stream) {
    frame.accept()
    yield frame.value
  }
}
