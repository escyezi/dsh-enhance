/**
 * Registration of the source-reference HTTP routes on the composed web server.
 *
 * Route keys are absolute pathnames; the browser half addresses them through
 * the document-relative `*_ROUTE` constants. Every handler asks the
 * composition's `connection` service for a rejection first, which is the same
 * Host/Origin and browser-login fence the rest of the Web surface uses.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { createSourceHandlers, type TrustFence } from './handlers.ts'
import type { SourceResolver } from './resolve.ts'
import type { SourceUpdateManager } from './update.ts'
import type { RuntimeVersion } from './shared.ts'
import {
  SOURCE_INSPECT_PATH,
  SOURCE_UPDATE_PATH,
  SOURCE_UPDATE_STATUS_PATH,
} from './shared.ts'

/** Dependencies shared by the route registrations. */
export interface SourceRouteDeps {
  /** Source inspection. */
  resolver: SourceResolver
  /** Update jobs. */
  manager: SourceUpdateManager
  /** Running DSH version detector. */
  runtimeVersion: () => RuntimeVersion | undefined
}

/**
 * Register the inspect, update, and status routes.
 * @param ctx - Host context carrying `webServer`, `connection`, and `subprocess`.
 * @param deps - resolver, manager, and runtime-version reader.
 */
export function registerSourceRoutes(ctx: Context, deps: SourceRouteDeps): void {
  const trust = Reflect.get(ctx, 'connection') as TrustFence | undefined
  if (trust === undefined) throw new Error('dsh-enhance-source: connection service is unavailable')
  const handlers = createSourceHandlers({
    trust,
    resolver: deps.resolver,
    manager: deps.manager,
    runtimeVersion: deps.runtimeVersion,
    logger: { warn: (message) => { ctx.logger.warn(message) } },
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SOURCE_INSPECT_PATH,
    handler: handlers.inspect,
  }), `dsh-enhance-source: POST ${SOURCE_INSPECT_PATH}`)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SOURCE_UPDATE_PATH,
    handler: handlers.update,
  }), `dsh-enhance-source: POST ${SOURCE_UPDATE_PATH}`)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SOURCE_UPDATE_STATUS_PATH,
    handler: handlers.status,
  }), `dsh-enhance-source: GET ${SOURCE_UPDATE_STATUS_PATH}`)
}
