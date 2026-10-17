/**
 * Money arithmetic and display for the balance chip. Amounts travel as integer
 * millionths of the currency unit, so sums stay exact.
 *
 * @module
 */
import type { AccountWallet } from '@deepseek-ai/dsh-deepseek-account/types'

/** Millionths of one currency unit; every amount travels in these. */
const MICRO_PER_UNIT = 1_000_000

/** Micro units in one cent. */
const MICRO_PER_CENT = 10_000

/**
 * @param currency - configured display currency.
 * @returns the currency's symbol.
 */
export function currencySymbol(currency: 'CNY' | 'USD'): string {
  return currency === 'CNY' ? '¥' : '$'
}

/**
 * Render one amount the way the account surfaces do: two decimals with grouped
 * digits, `<symbol>0.01` for a positive amount below one cent, and an explicit
 * sign for a negative one.
 * @param micro - amount in millionths of the currency unit.
 * @param currency - configured display currency.
 * @returns display text.
 */
export function formatMicro(micro: number, currency: 'CNY' | 'USD'): string {
  const symbol = currencySymbol(currency)
  const sign = micro < 0 ? '-' : ''
  const absolute = Math.abs(micro)
  if (absolute === 0) return `${symbol}0.00`
  if (absolute < MICRO_PER_CENT) return `${sign}<${symbol}0.01`
  const cents = Math.floor(absolute / MICRO_PER_CENT)
  const whole = Math.floor(cents / 100).toLocaleString('en-US')
  const fraction = String(cents % 100).padStart(2, '0')
  return `${sign}${symbol}${whole}.${fraction}`
}

/**
 * Sum the wallets of one currency.
 * @param wallets - wallet balances as the Platform reported them.
 * @param currency - currency to sum; wallets of other currencies are ignored.
 * @returns the total in millionths of the currency unit.
 */
export function walletMicro(wallets: readonly AccountWallet[], currency: 'CNY' | 'USD'): number {
  let total = 0
  for (const wallet of wallets) {
    if (wallet.currency !== currency) continue
    total += Math.round(Number(wallet.balance) * MICRO_PER_UNIT)
  }
  return total
}
