/**
 * Browser-side carrier for the source-reference routes.
 *
 * The page addresses document-relative routes (no leading slash), matching the
 * rest of the Web shell and the Desktop `dsh-app://app/` transport. Fetch is
 * injectable so component tests can script responses.
 *
 * @module
 */
import {
  SOURCE_INSPECT_ROUTE,
  SOURCE_UPDATE_ROUTE,
  SOURCE_UPDATE_STATUS_ROUTE,
  type SourceInspection,
  type SourceUpdateRequest,
  type UpdateStatus,
} from '../shared.ts'

/** Minimal fetch signature used by the controller. */
export type SourceFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

/** Result of one inspect request. */
export type InspectResult =
  | { readonly ok: true; readonly value: SourceInspection }
  | { readonly ok: false; readonly code?: string; readonly message: string }

/** Result of starting an update job. */
export type StartUpdateResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly code?: string; readonly message: string }

interface ErrorPayload {
  code?: unknown
  message?: unknown
}

interface StartPayload {
  id?: unknown
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function errorMessage(payload: unknown, status: number): { code?: string; message: string } {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as ErrorPayload
    const code = typeof record.code === 'string' ? record.code : undefined
    const message = typeof record.message === 'string' && record.message !== ''
      ? record.message
      : `HTTP ${String(status)}`
    return { ...code === undefined ? {} : { code }, message }
  }
  return { message: `HTTP ${String(status)}` }
}

/** Calls the three source routes; one instance lives with the browser half. */
export class SourcePageController {
  /** @param fetcher - HTTP carrier, injectable for tests. */
  constructor(private readonly fetcher: SourceFetcher = (input, init) => fetch(input, init)) {}

  /**
   * Read the current checkout inspection and the Host-detected runtime version.
   * @returns the inspection, or a transport/HTTP failure message.
   */
  async inspect(): Promise<InspectResult> {
    try {
      const response = await this.fetcher(SOURCE_INSPECT_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      const payload = await readJson(response)
      if (!response.ok) return { ok: false, ...errorMessage(payload, response.status) }
      if (typeof payload !== 'object' || payload === null) {
        return { ok: false, message: 'the Host returned no inspection' }
      }
      return { ok: true, value: payload as SourceInspection }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Start one update job; the Host resolves the runtime version itself.
   * @param request - `latest` or `version`.
   * @returns the job id, or a failure message.
   */
  async startUpdate(request: SourceUpdateRequest): Promise<StartUpdateResult> {
    try {
      const response = await this.fetcher(SOURCE_UPDATE_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      })
      const payload = await readJson(response)
      if (response.status !== 202) return { ok: false, ...errorMessage(payload, response.status) }
      const id = (payload as StartPayload | null)?.id
      if (typeof id !== 'string' || id === '') return { ok: false, message: 'the Host returned no job id' }
      return { ok: true, id }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Read one update job.
   * @param id - job id from {@link startUpdate}.
   * @returns the status, or null when the job is unknown or the read failed.
   */
  async updateStatus(id: string): Promise<UpdateStatus | null> {
    try {
      const response = await this.fetcher(`${SOURCE_UPDATE_STATUS_ROUTE}?id=${encodeURIComponent(id)}`, {
        headers: { accept: 'application/json' },
      })
      if (response.status === 404) return null
      if (!response.ok) return null
      const payload = await readJson(response)
      if (typeof payload !== 'object' || payload === null) return null
      return payload as UpdateStatus
    } catch {
      return null
    }
  }
}
