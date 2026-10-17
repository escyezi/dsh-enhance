import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, name } from '../src/index.ts'

const VALID = { balanceRefreshMs: 60_000 }

interface IndexInjection { kind: string; name: string; value: unknown }

function fakeContext(): {
  ctx: Context
  emitIndexInject: () => IndexInjection[]
} {
  const listeners: ((table: IndexInjection[]) => void)[] = []
  const ctx = {
    on: (event: string, listener: (table: IndexInjection[]) => void) => {
      if (event === 'webserver/index-inject') listeners.push(listener)
    },
    // Plan-X mounts through optional injections; this fixture only exercises
    // the always-on config publication.
    inject: () => () => {},
  } as unknown as Context
  return {
    ctx,
    emitIndexInject: () => {
      const table: IndexInjection[] = []
      for (const listener of listeners) listener(table)
      return table
    },
  }
}

describe('Host apply', () => {
  it('identifies itself', () => {
    expect(name).toBe('dsh-enhance')
  })

  it('publishes the browser configuration', () => {
    const fake = fakeContext()
    apply(fake.ctx, VALID)
    expect(fake.emitIndexInject()).toEqual([{
      kind: 'global',
      name: '__DSH_ENHANCE__',
      value: { balanceRefreshMs: VALID.balanceRefreshMs },
    }])
  })

  it('refuses an invalid configuration at load', () => {
    const fake = fakeContext()
    expect(() => { apply(fake.ctx, {}) }).toThrow(/dsh-enhance: invalid plugin config/u)
    expect(fake.emitIndexInject()).toEqual([])
  })
})
