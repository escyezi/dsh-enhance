import { describe, expect, it } from 'vitest'
import { parseEnhanceConfig } from '../src/config.ts'
import { ENHANCE_CONFIG_GLOBAL, readClientConfig } from '../src/client-config.ts'

const VALID = { balanceRefreshMs: 60_000 }

describe('parseEnhanceConfig', () => {
  it('accepts a complete configuration', () => {
    expect(parseEnhanceConfig(VALID)).toEqual(VALID)
  })

  it('rejects a missing refresh interval and names the field', () => {
    expect(() => parseEnhanceConfig({})).toThrow(/dsh-enhance: invalid plugin config \(balanceRefreshMs:/u)
  })

  it('rejects a negative or fractional interval', () => {
    expect(() => parseEnhanceConfig({ balanceRefreshMs: -1 })).toThrow(/balanceRefreshMs/u)
    expect(() => parseEnhanceConfig({ balanceRefreshMs: 1.5 })).toThrow(/balanceRefreshMs/u)
  })

  it('rejects an unknown extra key', () => {
    expect(() => parseEnhanceConfig({ ...VALID, extra: 1 })).toThrow(/\(root\):/u)
  })

  it('rejects retired pricing keys', () => {
    expect(() => parseEnhanceConfig({ ...VALID, currency: 'CNY' })).toThrow(/\(root\):/u)
    expect(() => parseEnhanceConfig({ ...VALID, pricingUrl: 'https://example.test' })).toThrow(/\(root\):/u)
    expect(() => parseEnhanceConfig({ ...VALID, rates: [] })).toThrow(/\(root\):/u)
  })
})

describe('client configuration', () => {
  it('publishes under one global name', () => {
    expect(ENHANCE_CONFIG_GLOBAL).toBe('__DSH_ENHANCE__')
  })

  it('reads a published configuration', () => {
    expect(readClientConfig({ balanceRefreshMs: 5 })).toEqual({ balanceRefreshMs: 5 })
  })

  it('degrades to no timer', () => {
    expect(readClientConfig(undefined)).toEqual({ balanceRefreshMs: 0 })
    expect(readClientConfig(null)).toEqual({ balanceRefreshMs: 0 })
    expect(readClientConfig({ balanceRefreshMs: -1 })).toEqual({ balanceRefreshMs: 0 })
    expect(readClientConfig({ balanceRefreshMs: 1.5 })).toEqual({ balanceRefreshMs: 0 })
  })
})
