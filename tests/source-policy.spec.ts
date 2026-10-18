import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import {
  CREATOR_PRESET_ID,
  SOURCE_PATH_CONTEXT,
  SOURCE_POLICY,
  SOURCE_POLICY_SECTION,
  registerSourcePolicy,
  sourceContextText,
  sourceSectionText,
} from '../packages/source/src/policy.ts'
import type { SourceResolver } from '../packages/source/src/resolve.ts'

const source = { path: '/Users/me/dsh source', version: '0.2.1-rc.2' }

describe('source policy text', () => {
  it('emits guidance only for Creator mode with a resolved checkout', () => {
    const text = sourceSectionText({ presetId: CREATOR_PRESET_ID, source })
    expect(text).toBe(SOURCE_POLICY)
    expect(text).toContain('read-only')
    expect(text).toContain('cordis-plugin-development')
    expect(text).toContain('tsdown.client.ts')
    expect(text).toContain('app.asar')
  })

  it('emits nothing for another preset, an unknown preset, or no checkout', () => {
    expect(sourceSectionText({ presetId: 'standard', source })).toBe('')
    expect(sourceSectionText({ presetId: undefined, source })).toBe('')
    expect(sourceSectionText({ presetId: CREATOR_PRESET_ID, source: null })).toBe('')
    expect(sourceContextText({ presetId: 'standard', source })).toBe('')
    expect(sourceContextText({ presetId: CREATOR_PRESET_ID, source: null })).toBe('')
  })

  it('names the JSON-escaped path and version in the runtime context', () => {
    const text = sourceContextText({ presetId: CREATOR_PRESET_ID, source })
    expect(text).toContain(JSON.stringify(source.path))
    expect(text).toContain('(version 0.2.1-rc.2)')
    expect(sourceContextText({ presetId: CREATOR_PRESET_ID, source: { path: '/src' } }))
      .toBe('Current DeepSeek Harness source checkout for Creator mode: "/src".')
  })
})

interface FakeSection {
  name: string
  order: number
  interpolate?: boolean
  text: (context: AssembleContext) => string
}

interface FakeContext {
  name: string
  order: number
  interpolate?: boolean
  text: (context: AssembleContext) => string
}

function fakeContext(preset: string): { ctx: Context; sections: FakeSection[]; contexts: FakeContext[] } {
  const sections: FakeSection[] = []
  const contexts: FakeContext[] = []
  const ctx = {
    effect: (register: () => unknown) => register(),
    systemPrompt: {
      section: (section: FakeSection) => { sections.push(section); return () => {} },
      context: (context: FakeContext) => { contexts.push(context); return () => {} },
      getSectionOrder: () => 10000,
      getContextOrder: () => 200,
    },
    agentPresets: { composedPreset: () => preset },
  }
  return { ctx: ctx as unknown as Context, sections, contexts }
}

function assembleContext(): AssembleContext {
  return { agent: { ctx: {} } } as unknown as AssembleContext
}

describe('registerSourcePolicy', () => {
  it('registers one section after HARNESS_SOURCE and one context after it', () => {
    const resolver = { resolve: () => source } as unknown as SourceResolver
    const { ctx, sections, contexts } = fakeContext('cordis')
    registerSourcePolicy(ctx, resolver)
    expect(sections).toHaveLength(1)
    expect(contexts).toHaveLength(1)
    expect(sections[0]?.name).toBe(SOURCE_POLICY_SECTION)
    expect(sections[0]?.order).toBe(10001)
    expect(sections[0]?.interpolate).toBe(false)
    expect(contexts[0]?.name).toBe(SOURCE_PATH_CONTEXT)
    expect(contexts[0]?.order).toBe(201)
    expect(contexts[0]?.interpolate).toBe(false)
    expect(sections[0]?.text(assembleContext())).toContain('read-only')
    expect(contexts[0]?.text(assembleContext())).toContain(JSON.stringify(source.path))
  })

  it('emits empty text for a standard session while still registering the slots', () => {
    const resolver = { resolve: () => source } as unknown as SourceResolver
    const { ctx, sections, contexts } = fakeContext('standard')
    registerSourcePolicy(ctx, resolver)
    expect(sections[0]?.text(assembleContext())).toBe('')
    expect(contexts[0]?.text(assembleContext())).toBe('')
  })

  it('emits empty text when there is no agent or no resolved checkout', () => {
    const resolver = { resolve: () => source } as unknown as SourceResolver
    const { ctx, sections } = fakeContext('cordis')
    registerSourcePolicy(ctx, resolver)
    expect(sections[0]?.text({} as AssembleContext)).toBe('')
    const noSource = { resolve: () => null } as unknown as SourceResolver
    const second = fakeContext('cordis')
    registerSourcePolicy(second.ctx, noSource)
    expect(second.sections[0]?.text(assembleContext())).toBe('')
  })
})
