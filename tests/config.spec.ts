import { describe, expect, it } from 'vitest'
import { parseBalanceConfig } from '../packages/balance/src/config.ts'
import { BALANCE_CONFIG_GLOBAL, readBalanceClientConfig } from '../packages/balance/src/client-config.ts'

const VALID = { balanceRefreshMs: 60_000 }

describe('parseBalanceConfig', () => {
  it('accepts a complete configuration', () => {
    expect(parseBalanceConfig(VALID)).toEqual(VALID)
  })

  it('rejects a missing refresh interval and names the field', () => {
    expect(() => parseBalanceConfig({})).toThrow(/dsh-enhance-balance: invalid plugin config \(balanceRefreshMs:/u)
  })

  it('rejects a negative or fractional interval', () => {
    expect(() => parseBalanceConfig({ balanceRefreshMs: -1 })).toThrow(/balanceRefreshMs/u)
    expect(() => parseBalanceConfig({ balanceRefreshMs: 1.5 })).toThrow(/balanceRefreshMs/u)
  })

  it('rejects an unknown extra key', () => {
    expect(() => parseBalanceConfig({ ...VALID, extra: 1 })).toThrow(/\(root\):/u)
  })

  it('rejects retired pricing keys', () => {
    expect(() => parseBalanceConfig({ ...VALID, currency: 'CNY' })).toThrow(/\(root\):/u)
    expect(() => parseBalanceConfig({ ...VALID, pricingUrl: 'https://example.test' })).toThrow(/\(root\):/u)
    expect(() => parseBalanceConfig({ ...VALID, rates: [] })).toThrow(/\(root\):/u)
  })
})

describe('balance client configuration', () => {
  it('publishes under one global name', () => {
    expect(BALANCE_CONFIG_GLOBAL).toBe('__DSH_ENHANCE_BALANCE__')
  })

  it('reads a published configuration', () => {
    expect(readBalanceClientConfig({ balanceRefreshMs: 5 })).toEqual({ balanceRefreshMs: 5 })
  })

  it('degrades to no timer', () => {
    expect(readBalanceClientConfig(undefined)).toEqual({ balanceRefreshMs: 0 })
    expect(readBalanceClientConfig(null)).toEqual({ balanceRefreshMs: 0 })
    expect(readBalanceClientConfig({ balanceRefreshMs: -1 })).toEqual({ balanceRefreshMs: 0 })
    expect(readBalanceClientConfig({ balanceRefreshMs: 1.5 })).toEqual({ balanceRefreshMs: 0 })
  })
})
