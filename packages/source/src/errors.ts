/**
 * Typed failures shared by the Host operations and the HTTP handlers.
 *
 * @module
 */
import type { SourceErrorCode } from './shared.ts'

/** A failure with a stable machine-readable code for the route/UI. */
export class SourceError extends Error {
  /**
   * @param code - stable code reported to the page.
   * @param message - user-visible detail; falls back to the code.
   * @param exitCode - exit code of the failing process, when known.
   */
  constructor(readonly code: SourceErrorCode, message?: string, readonly exitCode?: number | null) {
    super(message ?? code)
    this.name = 'SourceError'
  }
}
