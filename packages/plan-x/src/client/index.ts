/**
 * Browser half of Plan-X: the composer mode switch, the document Build action,
 * and the headless auto-open entry. Everything mounts only once the command and
 * session Remotes exist, so a composition without them simply has no Plan-X UI.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: declares `ctx.remote`, the services the Client receives from the Host.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
// Type-only: declares `ctx.conversation` and the composer/chat slot declarations.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: declares `ctx.slots`, the registry the registrations go through.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: declares the right-Sidebar document action slot.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
// Type-only: declares `ctx.sidebarRight`.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: adds `useProjection` to session-scoped slot props.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { en, NS, zh } from './locales.ts'
import { PlanXToggle, type PlanXToggleInjected } from './PlanXToggle.tsx'
import { PlanBuildButton, type PlanBuildInjected } from './PlanBuildButton.tsx'
import { PlanXAutoOpen, type PlanXAutoOpenInjected } from './PlanXAutoOpen.tsx'
import { buildPlan } from './build-plan.ts'

export { NS }

/** Services the registration needs; commands and session are injected per registration. */
export const inject = ['slots', 'locale', 'remote'] as const

/**
 * Register the Plan-X controls.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-enhance-plan-x: dictionaries')

  ctx.inject(['remote.commands', 'remote.session'], (scope) => {
    scope.slots.inject('conversation.input.left', () => scope.slots.register({
      name: 'conversation.input.left', id: 'plan-x', order: 20, locale: NS,
      inject: (sessionId: string): PlanXToggleInjected => {
        const id = sessionId as SessionId
        return {
          setActive: async (active) => {
            const command = active ? '/plan-x on' : '/plan-x off'
            const result = await scope.remote.commands.execute(id, command, [])
            if (!result.ok) return `${result.error.message} (${result.error.code})`
            if (result.value === undefined) return `unknown command: ${command}`
            return null
          },
        }
      },
    }, PlanXToggle))

    scope.inject(['sidebarRight'], (uiScope) => {
      uiScope.slots.inject('sidebar.right.tab.document.actions', () => uiScope.slots.register({
        name: 'sidebar.right.tab.document.actions', id: 'plan-x-build', locale: NS,
        inject: (sessionId: string): PlanBuildInjected => {
          const id = sessionId as SessionId
          return {
            build: (relativePath) => buildPlan({
              executeCommand: (sessionId, command) => scope.remote.commands.execute(sessionId, command, []),
              sendPrompt: (sessionId, text) => scope.remote.session.prompt({
                requestId: crypto.randomUUID() as SessionRequestId,
                sessionId,
                mode: 'queue',
                content: [{ type: 'text', text }],
                clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              }),
            }, id, relativePath),
          }
        },
      }, PlanBuildButton))

      uiScope.slots.inject('conversation.input.overlay', () => uiScope.slots.register({
        name: 'conversation.input.overlay', id: 'plan-x-auto-open', order: 0, locale: NS,
        inject: (sessionId: string): PlanXAutoOpenInjected => {
          const id = sessionId as SessionId
          return {
            openDocument: (path) => {
              uiScope.sidebarRight.openResource(sessionFileAddress(id, path))
            },
          }
        },
      }, PlanXAutoOpen))
    })
  })
}
