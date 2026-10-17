/**
 * Shared vocabulary of the balance feature: the deployment configuration both
 * halves read, and the small client-facing subset the Host republishes for the
 * browser.
 *
 * @module
 */

/** Deployment configuration of the balance row, read from the row's `config`. */
export interface BalanceConfig {
  /** Milliseconds between background balance reads; 0 disables the timer. */
  balanceRefreshMs: number
}

/** The subset of the configuration the browser half needs; published by the Host. */
export interface BalanceClientConfig {
  /** Milliseconds between background balance reads; 0 disables the timer. */
  balanceRefreshMs: number
}
