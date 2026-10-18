import { describe, expect, it } from 'vitest'
import { Config } from '../packages/source/src/config.ts'
import {
  DSH_TAG_PREFIX,
  SOURCE_BUNDLE,
  SOURCE_PACKAGE,
  SOURCE_ROW_ID,
  SOURCE_ROW_KEY,
} from '../packages/source/src/shared.ts'

interface VolatileValue {
  get(): string
}

function parsed(value: Record<string, unknown>): { sourcePath: VolatileValue } {
  return Config(value) as unknown as { sourcePath: VolatileValue }
}

describe('source config', () => {
  it('defaults an unset source path to an empty volatile field', () => {
    expect(parsed({}).sourcePath.get()).toBe('')
  })

  it('keeps a configured path in the volatile field', () => {
    expect(parsed({ sourcePath: '/Users/me/deepseek-harness' }).sourcePath.get())
      .toBe('/Users/me/deepseek-harness')
  })

  it('names the row with the bundle patch identity', () => {
    expect(SOURCE_PACKAGE).toBe('@escyezi/dsh-enhance-source')
    expect(SOURCE_BUNDLE).toBe('@escyezi/dsh-enhance')
    expect(SOURCE_ROW_ID).toBe('escyezi/dsh-enhance-source')
    // The Plugins page looks up a row's Configure page under the package name
    // of the bundle that declares the row, not the row module's own package.
    expect(SOURCE_ROW_KEY).toBe(`${SOURCE_BUNDLE}#${SOURCE_ROW_ID}`)
    expect(SOURCE_ROW_KEY).toBe('@escyezi/dsh-enhance#escyezi/dsh-enhance-source')
    expect(DSH_TAG_PREFIX).toBe('dsh-v')
  })
})
