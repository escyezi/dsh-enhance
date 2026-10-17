/**
 * The one owner of the account state stream and the balance reads behind the
 * sidebar chip: it follows sign-in state, re-reads on demand and on a timer,
 * and publishes an identity-stable snapshot the renderer binds to a hook.
 *
 * @module
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { AccountDetails, AccountView } from '@deepseek-ai/dsh-deepseek-account/types'
import { walletMicro } from './money.ts'

/** What the chip renders; `status` alone decides which branch. */
export interface BalanceSnapshot {
  /** Signed-out hides the chip, loading keeps it hidden, failed shows a retry affordance. */
  status: 'signed-out' | 'loading' | 'ready' | 'failed'
  /** Currency the amounts below are expressed in. */
  currency: 'CNY' | 'USD'
  /** Topped-up plus granted balance, in micro units. */
  totalMicro: number
  /** Topped-up balance, in micro units. */
  rechargedMicro: number
  /** Granted balance, in micro units. */
  bonusMicro: number
}

/** The chip's read face, its refresh command, and its lifetime. */
export interface BalanceSource {
  source: HostObservable<BalanceSnapshot>
  /** Read the balance now; shared with any in-flight read. */
  refresh: () => Promise<void>
  /** Stop the timer and release every listener. */
  dispose: () => void
}

/** Inputs of {@link createBalanceSource}. */
export interface BalanceSourceOptions {
  /** Account state frames; the source stops refreshing when this iterable ends. */
  frames: AsyncIterable<AccountView>
  /** One balance read; null means signed out or the grant changed during the read. */
  readBalance: () => Promise<AccountDetails['balance'] | null>
  /** Milliseconds between background reads; 0 disables the timer. */
  refreshMs: number
}

/** Currency used before the Platform reports one. */
const DEFAULT_CURRENCY: 'CNY' | 'USD' = 'CNY'

function emptySnapshot(status: BalanceSnapshot['status']): BalanceSnapshot {
  return { status, currency: DEFAULT_CURRENCY, totalMicro: 0, rechargedMicro: 0, bonusMicro: 0 }
}

/**
 * Follow one account stream and keep a balance snapshot current.
 * @param options - account frames, the balance read, and the refresh interval.
 * @returns the observable snapshot, its refresh command, and its disposer.
 */
export function createBalanceSource(options: BalanceSourceOptions): BalanceSource {
  let snapshot = emptySnapshot('loading')
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setInterval> | undefined
  let inFlight: Promise<void> | undefined
  let signedIn = false
  let disposed = false

  const publish = (next: BalanceSnapshot): void => {
    snapshot = next
    for (const listener of [...listeners]) listener()
  }
  const stopTimer = (): void => {
    if (timer === undefined) return
    clearInterval(timer)
    timer = undefined
  }
  const read = async (): Promise<void> => {
    let balance: AccountDetails['balance'] | null
    try {
      balance = await options.readBalance()
    } catch (_failedRead) {
      if (!disposed) publish(emptySnapshot('failed'))
      return
    }
    if (disposed) return
    if (balance === null || balance.status !== 'ready') {
      publish(emptySnapshot('failed'))
      return
    }
    const currency = balance.value[0]?.currency ?? balance.bonusWallets[0]?.currency ?? DEFAULT_CURRENCY
    const rechargedMicro = walletMicro(balance.value, currency)
    const bonusMicro = walletMicro(balance.bonusWallets, currency)
    publish({ status: 'ready', currency, totalMicro: rechargedMicro + bonusMicro, rechargedMicro, bonusMicro })
  }
  const refresh = (): Promise<void> => {
    if (!signedIn || disposed) return Promise.resolve()
    inFlight ??= read().finally(() => { inFlight = undefined })
    return inFlight
  }

  void (async () => {
    try {
      for await (const view of options.frames) {
        if (disposed) return
        if (view.status !== 'credential-stored') {
          signedIn = false
          stopTimer()
          publish(emptySnapshot('signed-out'))
          continue
        }
        signedIn = true
        if (options.refreshMs > 0 && timer === undefined) {
          timer = setInterval(() => { void refresh() }, options.refreshMs)
        }
        await refresh()
      }
    } catch (_droppedStream) {
      // A dropped stream leaves the last snapshot on screen; the next frame restores it.
      stopTimer()
    }
  })()

  return {
    source: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    refresh,
    dispose: () => {
      disposed = true
      stopTimer()
      listeners.clear()
    },
  }
}
