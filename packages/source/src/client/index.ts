/**
 * Browser half of the source-reference feature: the row configuration page.
 *
 * The page registers into the Plugins page's `plugins.row.config` keyed slot, so
 * it exists only while this bundle row is on. It talks to the Host through
 * document-relative routes; the Host owns the configured path and the runtime
 * version, never the browser.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: declares `ctx.locale`.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: declares `ctx.slots`.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: declares the `plugins.row.config` slot and its ConfigPageForm owner props.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { SourceUpdateRequest } from '../shared.ts'
import { SOURCE_ROW_KEY } from '../shared.ts'
import { SourcePageController } from './controller.ts'
import { en, NS, zh } from './locales.ts'
import { SourceConfigPage } from './SourceConfigPage.tsx'

export { NS }

/** Services required by the registration. */
export const inject = ['slots', 'locale', 'uiWorkspace'] as const

/** The subset of `uiWorkspace` this page uses. */
interface WorkspacePicker {
  pickDirectory(): Promise<string | null>
}

/**
 * Register the row configuration page.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-enhance-source: dictionaries')

  const controller = new SourcePageController()
  // `uiWorkspace` is injected by this plugin, so reading it through the
  // context proxy is allowed; the directory picker itself is optional in the
  // page's injected face.
  const workspace = Reflect.get(ctx, 'uiWorkspace') as WorkspacePicker | undefined
  const pickDirectory = workspace === undefined ? null : () => workspace.pickDirectory()

  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
    name: 'plugins.row.config',
    key: SOURCE_ROW_KEY,
    locale: NS,
    inject: () => ({
      inspect: () => controller.inspect(),
      startUpdate: (request: SourceUpdateRequest) => controller.startUpdate(request),
      updateStatus: (id: string) => controller.updateStatus(id),
      pickDirectory,
    }),
  }, SourceConfigPage))
}
