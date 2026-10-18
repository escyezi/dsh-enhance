/**
 * Creator-mode source guidance.
 *
 * The value-free instructions live in a system-prompt section; the checkout
 * path and version live in a runtime-context line. Both are emitted only when
 * the session's Agent preset is the built-in Creator preset (`cordis`) and the
 * configured checkout resolves. A changed path therefore adds one context
 * snapshot instead of rewriting the cached system prompt.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import type { ResolvedSource, SourceResolver } from './resolve.ts'

/** Built-in Agent preset the UI labels as Creator mode. */
export const CREATOR_PRESET_ID = 'cordis'

/** Prompt-section name; distinct from the built-in harness-source section. */
export const SOURCE_POLICY_SECTION = 'dsh-enhance-source:policy'

/** Runtime-context name carrying the current path/version. */
export const SOURCE_PATH_CONTEXT = 'dsh-enhance-source:checkout'

/** Fixed, value-free guidance emitted in Creator mode. */
export const SOURCE_POLICY = `Creator mode is active. A local DeepSeek Harness source checkout is available for reference; the runtime context names its path and version.

- Treat that checkout as read-only reference material. Never modify, move, format, or commit files in it; write plugin code only in the current working directory.
- Use it to confirm exact plugin APIs, extension points, Loader and Client-slot contracts, locale handling, and build tooling before writing code. Read the relevant package README and \`lib/types\` first, then \`src\` when the README is not enough.
- Useful starting points: \`packages/preset/agent-preset/skills/cordis-plugin-development/\`, \`packages/client/tsdown.client.ts\`, and the README of the package you are extending.
- The runtime context also names the running DSH installation checkout. It may be inside \`app.asar\`: direct file reads can work, but directory listing and globbing may not. Prefer this source checkout for exploration.
- If the checkout's version differs from the installed DSH, confirm contracts against the installed package's \`lib/types\` before relying on source alone.
- If the session's file policy denies a read, report the denial instead of guessing.`

/** Inputs of the two prompt-text builders. */
export interface SourcePolicyInput {
  /** Current Agent preset id, when known. */
  presetId: string | undefined
  /** Resolved source checkout, when configured and valid. */
  source: ResolvedSource | null
}

/**
 * Build the Creator-only system-prompt section text.
 * @param input - preset id and resolved checkout.
 * @returns the fixed guidance, or an empty string outside Creator mode or
 *   without a valid checkout.
 */
export function sourceSectionText(input: SourcePolicyInput): string {
  if (input.presetId !== CREATOR_PRESET_ID || input.source === null) return ''
  return SOURCE_POLICY
}

/**
 * Build the runtime-context line naming the current checkout.
 * @param input - preset id and resolved checkout.
 * @returns one line, or an empty string outside Creator mode or without a
 *   valid checkout.
 */
export function sourceContextText(input: SourcePolicyInput): string {
  if (input.presetId !== CREATOR_PRESET_ID || input.source === null) return ''
  const version = input.source.version === undefined ? '' : ` (version ${input.source.version})`
  return `Current DeepSeek Harness source checkout for Creator mode: ${JSON.stringify(input.source.path)}${version}.`
}

/** The subset of the Agent-preset registry this feature reads. */
interface AgentPresetResolver {
  composedPreset(agentCtx: Context): string | undefined
}

function presetOf(presets: AgentPresetResolver | undefined, context: AssembleContext): string | undefined {
  const agent = context.agent
  if (agent === undefined) return undefined
  try {
    return presets?.composedPreset(agent.ctx)
  } catch {
    // An unbound or unavailable registry means this session cannot be proven
    // to be Creator mode; emit nothing rather than guess.
    return undefined
  }
}

/**
 * Register the Creator-only source section and runtime context.
 * @param ctx - context carrying `systemPrompt` and `agentPresets`.
 * @param resolver - source resolver shared with the update route.
 */
export function registerSourcePolicy(ctx: Context, resolver: SourceResolver): void {
  // Capture the registry once from the injected context. Reading it through a
  // service proxy without declaring the dependency throws in Cordis, and the
  // prompt providers run outside this function.
  const presets = Reflect.get(ctx, 'agentPresets') as AgentPresetResolver | undefined

  ctx.effect(() => ctx.systemPrompt.section({
    name: SOURCE_POLICY_SECTION,
    order: ctx.systemPrompt.getSectionOrder('HARNESS_SOURCE') + 1,
    interpolate: false,
    text: (context) => sourceSectionText({
      presetId: presetOf(presets, context),
      source: resolver.resolve(),
    }),
  }), 'dsh-enhance-source: policy section')

  ctx.effect(() => ctx.systemPrompt.context({
    name: SOURCE_PATH_CONTEXT,
    order: ctx.systemPrompt.getContextOrder('HARNESS_SOURCE') + 1,
    interpolate: false,
    text: (context) => sourceContextText({
      presetId: presetOf(presets, context),
      source: resolver.resolve(),
    }),
  }), 'dsh-enhance-source: source context')
}
