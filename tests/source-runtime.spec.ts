import { describe, expect, it } from 'vitest'
import { detectRuntimeVersion, SEMVER } from '../packages/source/src/runtime.ts'

function detection(
  env: string | undefined,
  versions: Record<string, string | undefined>,
  baseUrl: string | undefined = 'file:///profile/',
) {
  return detectRuntimeVersion({
    env,
    baseUrl,
    packageVersion: (name) => versions[name],
  })
}

describe('detectRuntimeVersion', () => {
  it('prefers a well-formed DSH_CLIENT_VERSION from the running Host', () => {
    expect(detection('0.2.1-rc.2', { '@deepseek-ai/dsh': '9.9.9' }))
      .toEqual({ version: '0.2.1-rc.2', source: 'env' })
  })

  it('trims the environment value', () => {
    expect(detection('  0.2.1-rc.2  ', {})).toEqual({ version: '0.2.1-rc.2', source: 'env' })
  })

  it('falls back to the installed dsh package when the environment is absent', () => {
    expect(detection(undefined, { '@deepseek-ai/dsh': '0.2.1-rc.2' }))
      .toEqual({ version: '0.2.1-rc.2', source: 'installed' })
  })

  it('falls back to dsh-system-prompt when dsh is not resolvable', () => {
    expect(detection('', { '@deepseek-ai/dsh-system-prompt': '0.2.1-rc.2' }))
      .toEqual({ version: '0.2.1-rc.2', source: 'installed' })
  })

  it('ignores an invalid environment value and uses the installed package', () => {
    expect(detection('spoofed', { '@deepseek-ai/dsh': '0.2.1-rc.2' }))
      .toEqual({ version: '0.2.1-rc.2', source: 'installed' })
  })

  it('returns undefined when neither source yields a version', () => {
    expect(detection(undefined, {})).toBeUndefined()
    expect(detection('spoofed', { '@deepseek-ai/dsh': 'not-a-version' })).toBeUndefined()
  })

  it('does not attempt an installed lookup without a resolution base', () => {
    expect(detection(undefined, { '@deepseek-ai/dsh': '0.2.1-rc.2' }, '')).toBeUndefined()
  })

  it('accepts release and prerelease versions but rejects path-like values', () => {
    expect(SEMVER.test('1.2.3')).toBe(true)
    expect(SEMVER.test('0.2.1-rc.2')).toBe(true)
    expect(SEMVER.test('0.2.1-alpha.1')).toBe(true)
    expect(SEMVER.test('0.2')).toBe(false)
    expect(SEMVER.test('../0.2.1')).toBe(false)
    expect(SEMVER.test('0.2.1/../../x')).toBe(false)
  })
})
