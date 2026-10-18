import { describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SourceError } from '../packages/source/src/errors.ts'
import { createSourceHandlers, type TrustFence } from '../packages/source/src/handlers.ts'
import type { SourceResolver } from '../packages/source/src/resolve.ts'
import type { SourceUpdateManager } from '../packages/source/src/update.ts'
import type { SourceInspection, UpdateStatus } from '../packages/source/src/shared.ts'

interface FakeResponse {
  res: ServerResponse
  status(): number
  body(): unknown
  header(name: string): string | undefined
}

function request(
  method: string,
  url: string,
  body?: string,
  headers: Record<string, string> = { 'content-type': 'application/json' },
): IncomingMessage {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(body)])
  return Object.assign(stream, { method, url, headers }) as unknown as IncomingMessage
}

function response(): FakeResponse {
  let payload = ''
  const headers = new Map<string, string>()
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers.set(name, String(value)) },
    end(chunk?: string) { if (typeof chunk === 'string') payload += chunk },
  } as unknown as ServerResponse
  return {
    res,
    status: () => res.statusCode,
    body: () => payload === '' ? undefined : JSON.parse(payload) as unknown,
    header: name => headers.get(name),
  }
}

const inspection: SourceInspection = {
  path: '/tmp/source',
  exists: true,
  directory: true,
  checkout: true,
  version: '0.2.1-rc.2',
  branch: 'master',
  tag: 'dsh-v0.2.1-rc.2',
  head: '12345678',
  gitRepository: true,
  dependenciesInstalled: true,
  dirty: false,
}

const status: UpdateStatus = {
  action: 'latest',
  phase: 'running',
  output: '$ git fetch --prune origin\n',
}

const allow: TrustFence = { requestRejection: () => undefined }
const deny: TrustFence = { requestRejection: () => 401 }

function handlers(options: {
  trust?: TrustFence
  resolver?: SourceResolver
  manager?: SourceUpdateManager
  runtime?: () => { version: string; source: 'env' | 'installed' } | undefined
} = {}) {
  const inspect = vi.fn(async () => inspection)
  const start = vi.fn(async () => ({ id: 'job-1' }))
  const readStatus = vi.fn((): UpdateStatus | undefined => status)
  return createSourceHandlers({
    trust: options.trust ?? allow,
    resolver: (options.resolver ?? { inspect } as unknown as SourceResolver),
    manager: (options.manager ?? { start, status: readStatus } as unknown as SourceUpdateManager),
    runtimeVersion: options.runtime ?? (() => ({ version: '0.2.1-rc.2', source: 'env' })),
  })
}

describe('source route authentication', () => {
  it('rejects unauthenticated requests before reading the body or inspecting', async () => {
    const inspect = vi.fn(async () => inspection)
    const { inspect: handler } = handlers({ trust: deny, resolver: { inspect } as unknown as SourceResolver })
    const reply = response()
    await handler(request('POST', '/dsh-enhance/source/inspect', '{}'), reply.res)
    expect(reply.status()).toBe(401)
    expect(inspect).not.toHaveBeenCalled()
  })
})

describe('source inspect route', () => {
  it('rejects a non-POST method', async () => {
    const { inspect } = handlers()
    const reply = response()
    await inspect(request('GET', '/dsh-enhance/source/inspect'), reply.res)
    expect(reply.status()).toBe(405)
    expect(reply.header('allow')).toBe('POST')
  })

  it('rejects a non-JSON media type', async () => {
    const { inspect } = handlers()
    const reply = response()
    await inspect(request('POST', '/dsh-enhance/source/inspect', '{}', { 'content-type': 'text/plain' }), reply.res)
    expect(reply.status()).toBe(415)
  })

  it('rejects an oversized body', async () => {
    const { inspect } = handlers()
    const reply = response()
    await inspect(request('POST', '/dsh-enhance/source/inspect', 'x'.repeat(70 * 1024)), reply.res)
    expect(reply.status()).toBe(413)
  })

  it('rejects malformed JSON', async () => {
    const { inspect } = handlers()
    const reply = response()
    await inspect(request('POST', '/dsh-enhance/source/inspect', '{'), reply.res)
    expect(reply.status()).toBe(400)
  })

  it('returns the inspection plus the Host-detected runtime version', async () => {
    const { inspect } = handlers()
    const reply = response()
    await inspect(request('POST', '/dsh-enhance/source/inspect', '{}'), reply.res)
    expect(reply.status()).toBe(200)
    expect(reply.header('cache-control')).toBe('no-store')
    expect(reply.body()).toMatchObject({
      path: '/tmp/source',
      checkout: true,
      runtimeVersion: { version: '0.2.1-rc.2', source: 'env' },
    })
  })
})

describe('source update route', () => {
  it('rejects a missing or unknown action', async () => {
    const { update } = handlers()
    for (const body of ['{}', '{"action":"other"}']) {
      const reply = response()
      await update(request('POST', '/dsh-enhance/source/update', body), reply.res)
      expect(reply.status()).toBe(400)
      expect(reply.body()).toMatchObject({ code: 'unknown-action' })
    }
  })

  it('starts the latest action with only the action on the wire', async () => {
    const start = vi.fn(async () => ({ id: 'job-7' }))
    const { update } = handlers({ manager: { start, status: vi.fn() } as unknown as SourceUpdateManager })
    const reply = response()
    await update(request('POST', '/dsh-enhance/source/update', '{"action":"latest"}'), reply.res)
    expect(reply.status()).toBe(202)
    expect(reply.body()).toEqual({ id: 'job-7' })
    expect(start).toHaveBeenCalledWith({ action: 'latest' })
  })

  it('ignores a client-supplied version for the version action', async () => {
    const start = vi.fn(async () => ({ id: 'job-8' }))
    const { update } = handlers({ manager: { start, status: vi.fn() } as unknown as SourceUpdateManager })
    const reply = response()
    await update(request('POST', '/dsh-enhance/source/update', '{"action":"version","version":"v9.9.9"}'), reply.res)
    expect(reply.status()).toBe(202)
    expect(start).toHaveBeenCalledWith({ action: 'version' })
  })

  it('maps an unavailable runtime version to 409', async () => {
    const start = vi.fn(async () => { throw new SourceError('runtime-version-unavailable', 'no runtime version') })
    const { update } = handlers({ manager: { start, status: vi.fn() } as unknown as SourceUpdateManager })
    const reply = response()
    await update(request('POST', '/dsh-enhance/source/update', '{"action":"version"}'), reply.res)
    expect(reply.status()).toBe(409)
    expect(reply.body()).toMatchObject({ code: 'runtime-version-unavailable' })
  })

  it('maps a missing git to 503', async () => {
    const start = vi.fn(async () => { throw new SourceError('git-missing', 'git is unavailable') })
    const { update } = handlers({ manager: { start, status: vi.fn() } as unknown as SourceUpdateManager })
    const reply = response()
    await update(request('POST', '/dsh-enhance/source/update', '{"action":"latest"}'), reply.res)
    expect(reply.status()).toBe(503)
    expect(reply.body()).toMatchObject({ code: 'git-missing' })
  })
})

describe('source status route', () => {
  it('returns a known job status', async () => {
    const { status: handler } = handlers()
    const reply = response()
    await handler(request('GET', '/dsh-enhance/source/update/status?id=job-1'), reply.res)
    expect(reply.status()).toBe(200)
    expect(reply.body()).toMatchObject({ action: 'latest', phase: 'running' })
  })

  it('returns 404 for an unknown job and 400 for a missing id', async () => {
    const readStatus = vi.fn((): UpdateStatus | undefined => undefined)
    const { status: handler } = handlers({ manager: { start: vi.fn(), status: readStatus } as unknown as SourceUpdateManager })
    const missingJob = response()
    await handler(request('GET', '/dsh-enhance/source/update/status?id=missing'), missingJob.res)
    expect(missingJob.status()).toBe(404)
    const missingId = response()
    await handler(request('GET', '/dsh-enhance/source/update/status'), missingId.res)
    expect(missingId.status()).toBe(400)
  })

  it('rejects a non-GET method', async () => {
    const { status: handler } = handlers()
    const reply = response()
    await handler(request('POST', '/dsh-enhance/source/update/status?id=job-1', '{}'), reply.res)
    expect(reply.status()).toBe(405)
    expect(reply.header('allow')).toBe('GET')
  })
})
