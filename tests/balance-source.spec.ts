import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AccountDetails, AccountView } from '@deepseek-ai/dsh-deepseek-account/types'
import { createBalanceSource } from '../src/client/balance/balance-source.ts'

function accountView(status: 'credential-stored' | 'signed-out'): AccountView {
  return { status, links: { usageUrl: 'https://example.test/usage', topUpUrl: 'https://example.test/top_up' }, attempt: null }
}

function readyBalance(recharged: string, bonus: string): AccountDetails['balance'] {
  return {
    status: 'ready',
    value: [{ currency: 'CNY', balance: recharged }],
    bonusWallets: [{ currency: 'CNY', balance: bonus }],
  }
}

/** An account-state iterable the test drives frame by frame. */
function controlledFrames(): { frames: AsyncIterable<AccountView>; push: (value: AccountView) => void } {
  const queue: AccountView[] = []
  let wake: (() => void) | undefined
  const frames: AsyncIterable<AccountView> = {
    [Symbol.asyncIterator]() {
      return {
        next: async (): Promise<IteratorResult<AccountView>> => {
          while (queue.length === 0) await new Promise<void>((resolve) => { wake = resolve })
          const value = queue.shift()
          return value === undefined ? { done: true, value: undefined } : { done: false, value }
        },
      }
    },
  }
  return {
    frames,
    push: (value) => { queue.push(value); wake?.(); wake = undefined },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createBalanceSource', () => {
  it('publishes the summed balance once the account is signed in', async () => {
    const frames = controlledFrames()
    const source = createBalanceSource({
      frames: frames.frames, refreshMs: 0, readBalance: async () => readyBalance('10.5', '0.25'),
    })
    frames.push(accountView('credential-stored'))
    await vi.waitFor(() => { expect(source.source.getSnapshot().status).toBe('ready') })
    expect(source.source.getSnapshot()).toMatchObject({
      currency: 'CNY', totalMicro: 10_750_000, rechargedMicro: 10_500_000, bonusMicro: 250_000,
    })
    source.dispose()
  })

  it('starts hidden and returns to hidden on sign-out', async () => {
    const frames = controlledFrames()
    const source = createBalanceSource({
      frames: frames.frames, refreshMs: 0, readBalance: async () => readyBalance('1', '0'),
    })
    expect(source.source.getSnapshot().status).toBe('loading')
    frames.push(accountView('credential-stored'))
    await vi.waitFor(() => { expect(source.source.getSnapshot().status).toBe('ready') })
    frames.push(accountView('signed-out'))
    await vi.waitFor(() => { expect(source.source.getSnapshot().status).toBe('signed-out') })
    expect(source.source.getSnapshot().totalMicro).toBe(0)
    source.dispose()
  })

  it('reports a failed read instead of a zero balance', async () => {
    const frames = controlledFrames()
    const source = createBalanceSource({
      frames: frames.frames, refreshMs: 0, readBalance: async () => { throw new Error('offline') },
    })
    frames.push(accountView('credential-stored'))
    await vi.waitFor(() => { expect(source.source.getSnapshot().status).toBe('failed') })
    source.dispose()
  })

  it('treats a null or non-ready outcome as failed', async () => {
    const frames = controlledFrames()
    const source = createBalanceSource({
      frames: frames.frames, refreshMs: 0, readBalance: async () => ({ status: 'failed' } as AccountDetails['balance']),
    })
    frames.push(accountView('credential-stored'))
    await vi.waitFor(() => { expect(source.source.getSnapshot().status).toBe('failed') })
    source.dispose()
  })

  it('re-reads on the configured interval and shares one in-flight read', async () => {
    vi.useFakeTimers()
    const frames = controlledFrames()
    let balance = readyBalance('1', '0')
    let reads = 0
    const source = createBalanceSource({
      frames: frames.frames,
      refreshMs: 1_000,
      readBalance: async () => { reads += 1; return balance },
    })
    frames.push(accountView('credential-stored'))
    await vi.advanceTimersByTimeAsync(0)
    expect(source.source.getSnapshot().totalMicro).toBe(1_000_000)

    const first = source.refresh()
    const second = source.refresh()
    await Promise.all([first, second])
    expect(reads).toBe(2)

    balance = readyBalance('2.5', '0')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(source.source.getSnapshot().totalMicro).toBe(2_500_000)
    expect(reads).toBe(3)
    source.dispose()
  })

  it('stops reading and notifying once disposed', async () => {
    vi.useFakeTimers()
    const frames = controlledFrames()
    let reads = 0
    const source = createBalanceSource({
      frames: frames.frames, refreshMs: 1_000, readBalance: async () => { reads += 1; return readyBalance('1', '0') },
    })
    const listener = vi.fn()
    source.source.subscribe(listener)
    frames.push(accountView('credential-stored'))
    await vi.advanceTimersByTimeAsync(0)
    expect(reads).toBe(1)

    source.dispose()
    await source.refresh()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(reads).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
