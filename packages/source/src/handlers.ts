/**
 * HTTP handlers for the source-reference routes.
 *
 * The handlers own the wire boundary: authentication fence, method and media
 * type, bounded body, JSON shape, and error-code to status mapping. They are
 * created as plain functions so tests can drive them with fake Node request and
 * response objects without starting an HTTP server.
 *
 * @module
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SourceError } from './errors.ts'
import type { SourceInspection, SourceUpdateRequest, RuntimeVersion, UpdateStatus } from './shared.ts'
import type { SourceResolver } from './resolve.ts'
import type { SourceUpdateManager } from './update.ts'

/** Trust fence supplied by the composition's `connection` service. */
export interface TrustFence {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

/** Dependencies of the created handlers. */
export interface SourceHandlerDeps {
  /** Host/Origin + browser-auth fence. */
  trust: TrustFence
  /** Source inspection used by the inspect route and update preconditions. */
  resolver: SourceResolver
  /** Update jobs. */
  manager: SourceUpdateManager
  /** Running DSH version detector. */
  runtimeVersion: () => RuntimeVersion | undefined
  /** Optional diagnostic sink for unexpected failures. */
  logger?: { warn: (message: string) => void } | undefined
}

/** The three route handlers. */
export interface SourceHandlers {
  inspect: (req: IncomingMessage, res: ServerResponse) => Promise<void>
  update: (req: IncomingMessage, res: ServerResponse) => Promise<void>
  status: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}

/** Tiny request bodies only; anything larger is hostile. */
const MAX_BODY_BYTES = 64 * 1024

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

function sendMethodNotAllowed(res: ServerResponse, allow: 'POST' | 'GET'): void {
  res.statusCode = 405
  res.setHeader('allow', allow)
  res.end()
}

async function readBoundedBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      // Drain the remainder so the refusal is a readable response.
      req.resume()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

function isJson(req: IncomingMessage): boolean {
  const essence = String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase()
  return essence === 'application/json'
}

function parseObject(text: string): Record<string, unknown> | null {
  if (text.trim() === '') return {}
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function statusOf(code: string): number {
  switch (code) {
    case 'bad-request':
    case 'unknown-action':
    case 'not-configured':
    case 'not-absolute':
      return 400
    case 'git-missing':
      return 503
    case 'internal':
      return 500
    default:
      return 409
  }
}

function sendFailure(res: ServerResponse, error: unknown, logger: SourceHandlerDeps['logger']): void {
  if (error instanceof SourceError) {
    sendJson(res, statusOf(error.code), { code: error.code, message: error.message })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  logger?.warn(`dsh-enhance-source: ${message}`)
  sendJson(res, 500, { code: 'internal', message: 'internal error' })
}

/**
 * Build the three route handlers.
 * @param deps - trust fence, resolver, manager, runtime-version reader, logger.
 * @returns handler functions with the Node HTTP route signature.
 */
export function createSourceHandlers(deps: SourceHandlerDeps): SourceHandlers {
  const rejected = (req: IncomingMessage, res: ServerResponse): boolean => {
    const rejection = deps.trust.requestRejection(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  const readBody = async (req: IncomingMessage, res: ServerResponse): Promise<Record<string, unknown> | null> => {
    if (!isJson(req)) {
      sendJson(res, 415, { code: 'bad-request', message: 'content-type must be application/json' })
      return null
    }
    let text: string | null
    try {
      text = await readBoundedBody(req)
    } catch {
      sendJson(res, 400, { code: 'bad-request', message: 'request body unreadable' })
      return null
    }
    if (text === null) {
      sendJson(res, 413, { code: 'bad-request', message: 'request body is too large' })
      return null
    }
    const body = parseObject(text)
    if (body === null) {
      sendJson(res, 400, { code: 'bad-request', message: 'request body must be a JSON object' })
      return null
    }
    return body
  }

  return {
    async inspect(req, res) {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res, 'POST')
        return
      }
      if (await readBody(req, res) === null) return
      try {
        const inspection: SourceInspection = await deps.resolver.inspect()
        sendJson(res, 200, { ...inspection, runtimeVersion: deps.runtimeVersion() })
      } catch (error) {
        sendFailure(res, error, deps.logger)
      }
    },

    async update(req, res) {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res, 'POST')
        return
      }
      const body = await readBody(req, res)
      if (body === null) return
      const action = body['action']
      if (action !== 'latest' && action !== 'version') {
        sendJson(res, 400, { code: 'unknown-action', message: 'action must be "latest" or "version"' })
        return
      }
      const request: SourceUpdateRequest = { action }
      try {
        const started = await deps.manager.start(request)
        sendJson(res, 202, started)
      } catch (error) {
        sendFailure(res, error, deps.logger)
      }
    },

    async status(req, res) {
      if (rejected(req, res)) return
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, 'GET')
        return
      }
      const id = new URL(String(req.url), 'http://localhost').searchParams.get('id')
      if (id === null || id === '') {
        sendJson(res, 400, { code: 'bad-request', message: 'id is required' })
        return
      }
      const status: UpdateStatus | undefined = deps.manager.status(id)
      if (status === undefined) {
        sendJson(res, 404, { code: 'not-found', message: `unknown update job: ${id}` })
        return
      }
      sendJson(res, 200, status)
    },
  }
}
