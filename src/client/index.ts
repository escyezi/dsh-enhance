/**
 * Browser half of DSH增强: the sidebar balance chip plus the Plan-X controls.
 *
 * Balance stays independent of Plan-X: its one optional capability is the
 * account Remote. Plan-X controls mount only once their command, session, and
 * right-Sidebar services exist, so a composition without them still gets the
 * balance feature.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: declares `ctx.remote`, the services the Client receives from the Host.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: declares `ctx.sessions` and the Agent-scope conversation face.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote'
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
import type { AccountDetails, AccountView } from '@deepseek-ai/dsh-deepseek-account/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { ENHANCE_CONFIG_GLOBAL, readClientConfig } from '../client-config.ts'
import { en, NS, zh } from './locales.ts'
import { createBalanceSource } from './balance/balance-source.ts'
import { BalanceChip, type BalanceChipInjected } from './balance/BalanceChip.tsx'
import { PlanXToggle, type PlanXToggleInjected } from './plan-x/PlanXToggle.tsx'
import { PlanBuildButton, type PlanBuildInjected } from './plan-x/PlanBuildButton.tsx'
import { PlanXAutoOpen, type PlanXAutoOpenInjected } from './plan-x/PlanXAutoOpen.tsx'

export { NS }

/** Services the registration needs; the account Remote is optional and injected per registration. */
export const inject = ['slots', 'locale', 'remote'] as const

/**
 * Register the balance chip and the Plan-X controls.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-enhance: dictionaries')
  const clientConfig = readClientConfig((globalThis as Record<string, unknown>)[ENHANCE_CONFIG_GLOBAL])

  // The account Remote is an optional capability: without it the chip is absent.
  ctx.inject(['remote.account'], (scope) => {
    const stream = scope.remote.$stream<AccountView>({
      name: 'account',
      open: (signal: AbortSignal) => scope.remote.account.watch(signal),
      ended: () => new Error('account stream ended'),
    })
    scope.effect(() => () => stream.dispose(), 'dsh-enhance: account stream')
    const balance = createBalanceSource({
      frames: accepted(stream),
      refreshMs: clientConfig.balanceRefreshMs,
      readBalance: async (): Promise<AccountDetails['balance'] | null> => {
        const result = await scope.remote.account.getBalance({
          // The client build embeds its product version; the Host derives the Platform headers from it.
          version: process.env.DSH_CLIENT_VERSION ?? '0.0.0',
          locale: ctx.locale.getSnapshot().active,
          // Date.getTimezoneOffset reports minutes west of UTC; Platform wants seconds east.
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
        })
        if (!result.ok) throw new Error('account balance failed')
        return result.value
      },
    })
    scope.effect(() => () => balance.dispose(), 'dsh-enhance: balance source')
    scope.slots.inject('sidebar.footer.action', () => scope.slots.register({
      name: 'sidebar.footer.action', id: 'balance', order: 0, locale: NS,
      inject: (): BalanceChipInjected => ({ refresh: balance.refresh, hooks: { balance: balance.source } }),
    }, BalanceChip))
  })

  // Plan-X UI is independent of the account capability. Commands and session
  // scopes carry the toggle and Build action; the right Sidebar adds document
  // navigation and the headless auto-open entry.
  ctx.inject(['remote.commands', 'sessions'], (scope) => {
    // The client Session service exposes `scope`; the Host `SessionStore`
    // augmentation shares the `sessions` key in some type environments, so read
    // the one method this feature needs through a local structural face.
    const sessions = scope.sessions as unknown as {
      scope(id: SessionId): { conversation: { send(text: string): Promise<void> } } | undefined
    }
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
            build: async (relativePath) => {
              const off = await scope.remote.commands.execute(id, '/plan-x off', [])
              if (!off.ok) return `${off.error.message} (${off.error.code})`
              if (off.value === undefined) return 'unknown command: /plan-x off'
              const agent = sessions.scope(id)
              if (agent === undefined) return 'The session is not active.'
              try {
                await agent.conversation.send(
                  `Build the plan at ${relativePath}. Read the plan document, then implement it end to end. `
                  + 'Do not ask for approval; carry out the plan.',
                )
              } catch (reason) {
                return reason instanceof Error ? reason.message : String(reason)
              }
              return null
            },
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

/**
 * Drive one Remote stream to completion, acknowledging each consumed frame.
 * @param stream - frames of the account state stream.
 * @returns the frames' values as an async iterable.
 */
async function* accepted<T>(stream: AsyncIterable<{ value: T; accept: () => void }>): AsyncIterable<T> {
  for await (const frame of stream) {
    frame.accept()
    yield frame.value
  }
}
