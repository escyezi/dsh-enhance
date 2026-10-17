import { describe, expect, it } from 'vitest'
import { currencySymbol, formatMicro, walletMicro } from '../src/client/balance/money.ts'

describe('currencySymbol', () => {
  it('names each supported currency', () => {
    expect(currencySymbol('CNY')).toBe('¥')
    expect(currencySymbol('USD')).toBe('$')
  })
})

describe('formatMicro', () => {
  it('renders zero without a sign', () => {
    expect(formatMicro(0, 'CNY')).toBe('¥0.00')
  })

  it('renders a positive sub-cent amount as less than one cent', () => {
    expect(formatMicro(1, 'CNY')).toBe('<¥0.01')
    expect(formatMicro(9_999, 'CNY')).toBe('<¥0.01')
  })

  it('rounds down to whole cents with grouped digits', () => {
    expect(formatMicro(10_000, 'CNY')).toBe('¥0.01')
    expect(formatMicro(1_234_567_890, 'CNY')).toBe('¥1,234.56')
    expect(formatMicro(2_000_000, 'USD')).toBe('$2.00')
  })

  it('keeps the sign of a negative amount', () => {
    expect(formatMicro(-20_000, 'CNY')).toBe('-¥0.02')
    expect(formatMicro(-1, 'CNY')).toBe('-<¥0.01')
  })
})

describe('walletMicro', () => {
  it('sums the wallets of one currency', () => {
    expect(walletMicro([{ currency: 'CNY', balance: '10.5' }, { currency: 'CNY', balance: '0.25' }], 'CNY'))
      .toBe(10_750_000)
  })

  it('ignores other currencies', () => {
    expect(walletMicro([{ currency: 'USD', balance: '5' }], 'CNY')).toBe(0)
  })

  it('reads the platform decimal forms', () => {
    expect(walletMicro([{ currency: 'CNY', balance: '1e+3' }], 'CNY')).toBe(1_000_000_000)
    expect(walletMicro([{ currency: 'CNY', balance: '0E-16' }], 'CNY')).toBe(0)
  })
})
