/**
 * Shared vocabulary of DSH增强: the deployment configuration both halves read,
 * and the small client-facing subset the Host republishes for the browser.
 *
 * @module
 */

/** Deployment configuration of the plugin, read from the profile row's `config`. */
export interface EnhanceConfig {
  /** Milliseconds between background balance reads; 0 disables the timer. */
  balanceRefreshMs: number
}

/** The subset of the configuration the browser half needs; published by the Host. */
export interface EnhanceClientConfig {
  /** Milliseconds between background balance reads; 0 disables the timer. */
  balanceRefreshMs: number
}
