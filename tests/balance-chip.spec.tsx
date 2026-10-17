// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BalanceChip, type BalanceChipProps } from '../packages/balance/src/client/BalanceChip.tsx'
import type { BalanceSnapshot } from '../packages/balance/src/client/balance-source.ts'
import { zh } from '../packages/balance/src/client/locales.ts'

afterEach(cleanup)

/** Dictionary-backed translate, so assertions read the product copy. */
function translate(key: keyof typeof zh, params?: Record<string, string | number>): string {
  return String(zh[key]).replaceAll(/\{(\w+)\}/gu, (_match, name: string) => String(params?.[name] ?? ''))
}

function props(snapshot: BalanceSnapshot, overrides: Partial<BalanceChipProps> = {}): BalanceChipProps {
  return {
    wide: true,
    useBalance: (selector: (value: BalanceSnapshot) => unknown) => selector(snapshot),
    refresh: async () => {},
    t: translate,
    ...overrides,
  } as unknown as BalanceChipProps
}

const READY: BalanceSnapshot = {
  status: 'ready', currency: 'CNY', totalMicro: 12_340_000, rechargedMicro: 10_000_000, bonusMicro: 2_340_000,
}

describe('BalanceChip', () => {
  it('leads with the topped-up amount and lists the granted one beneath it', () => {
    render(<BalanceChip {...props(READY)} />)
    for (const text of ['充值余额', '赠金', '¥10.00', '¥2.34']) {
      expect(screen.getByText(text)).toBeDefined()
    }
    // The available total survives in the copy only.
    expect(screen.queryByText('可用余额')).toBeNull()
    expect(screen.queryByText('¥12.34')).toBeNull()
    const button = screen.getByRole('button')
    expect(button.getAttribute('data-enhance-balance')).toBe('ready')
    expect(button.getAttribute('aria-label')).toBe('可用余额 ¥12.34（充值 ¥10.00 · 赠金 ¥2.34）· 点击刷新')
    expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'))
  })

  it('drops the granted row once the bonus is spent', () => {
    render(<BalanceChip {...props({ ...READY, bonusMicro: 0, totalMicro: 10_000_000 })} />)
    expect(screen.getByText('充值余额')).toBeDefined()
    expect(screen.getByText('¥10.00')).toBeDefined()
    expect(screen.queryByText('赠金')).toBeNull()
    expect(screen.getByRole('button').getAttribute('aria-label'))
      .toBe('可用余额 ¥10.00（充值 ¥10.00）· 点击刷新')
  })

  it('shows only the currency mark in the collapsed rail', () => {
    render(<BalanceChip {...props(READY, { wide: false })} />)
    expect(screen.getByText('¥')).toBeDefined()
    expect(screen.queryByText('充值余额')).toBeNull()
    expect(screen.queryByText('¥10.00')).toBeNull()
    expect(screen.getByRole('button').getAttribute('data-enhance-balance')).toBe('ready')
  })

  it('stays hidden while signed out or loading', () => {
    const { container: signedOut } = render(
      <BalanceChip {...props({ ...READY, status: 'signed-out', totalMicro: 0 })} />,
    )
    expect(signedOut.firstChild).toBeNull()
    const { container: loading } = render(<BalanceChip {...props({ ...READY, status: 'loading' })} />)
    expect(loading.firstChild).toBeNull()
  })

  it('offers a retry affordance when the read failed', () => {
    const refresh = vi.fn(async () => {})
    const { container } = render(<BalanceChip {...props({ ...READY, status: 'failed', totalMicro: 0 }, { refresh })} />)
    expect(screen.getByText('余额不可用')).toBeDefined()
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByRole('button').getAttribute('title')).toBe('暂时读不到余额，点击重试')
    fireEvent.click(screen.getByRole('button'))
    expect((refresh as Mock).mock.calls).toHaveLength(1)
  })

  it('re-reads when the ready chip is clicked', () => {
    const refresh = vi.fn(async () => {})
    render(<BalanceChip {...props(READY, { refresh })} />)
    fireEvent.click(screen.getByRole('button'))
    expect((refresh as Mock).mock.calls).toHaveLength(1)
  })
})
