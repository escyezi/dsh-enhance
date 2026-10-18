import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NS as BALANCE_NS } from '../packages/balance/src/client/locales.ts'
import { NS as PLAN_X_NS } from '../packages/plan-x/src/client/locales.ts'
import { NS as SOURCE_NS } from '../packages/source/src/client/locales.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, relative), 'utf8')) as Record<string, unknown>
}

function readText(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
}

function assertFeatureManifest(manifest: Record<string, unknown>, name: string): void {
  const dsh = manifest['dsh'] as Record<string, unknown>
  const exportsField = manifest['exports'] as Record<string, unknown>
  expect(manifest['name']).toBe(name)
  expect(manifest['main']).toBe('lib/index.js')
  expect(exportsField['.']).toBe('./lib/index.js')
  expect(exportsField['./client']).toBe('./lib/client.js')
  expect(exportsField['./locale/*.json']).toBe('./locale/*.json')
  expect(exportsField['./icon']).toBe('./icon.svg')
  expect(dsh['client']).toEqual({ platform: 'web' })
  expect(manifest['files'] as string[]).toEqual(
    expect.arrayContaining(['lib/**', 'locale/*.json', 'icon.svg']),
  )
}

function meta(relative: string): Record<string, string> {
  return readJson(relative)['meta'] as Record<string, string>
}

describe('bundle display resources', () => {
  it('declares only the bundle patch and its three feature dependencies', () => {
    const manifest = readJson('package.json')
    const dsh = manifest['dsh'] as Record<string, unknown>
    expect(manifest['name']).toBe('@escyezi/dsh-enhance')
    expect(dsh['bundle']).toEqual({ patch: './cordis.patch.yml' })
    expect(dsh['client']).toBeUndefined()
    expect(manifest['main']).toBeUndefined()
    expect((manifest['exports'] as Record<string, unknown>)['./cordis.patch.yml']).toBe('./cordis.patch.yml')
    expect((manifest['exports'] as Record<string, unknown>)['./icon']).toBe('./icon.svg')
    expect((manifest['exports'] as Record<string, unknown>)['./locale/*.json']).toBe('./locale/*.json')
    expect(manifest['dependencies']).toEqual({
      '@escyezi/dsh-enhance-balance': 'workspace:*',
      '@escyezi/dsh-enhance-plan-x': 'workspace:*',
      '@escyezi/dsh-enhance-source': 'workspace:*',
    })
    expect(manifest['files'] as string[]).toEqual(
      expect.arrayContaining(['cordis.patch.yml', 'locale/*.json', 'icon.svg']),
    )
    expect(manifest['files'] as string[]).not.toContain('lib/**')
  })

  it('declares all three feature packages as independent client plugins', () => {
    assertFeatureManifest(readJson('packages/balance/package.json'), '@escyezi/dsh-enhance-balance')
    assertFeatureManifest(readJson('packages/plan-x/package.json'), '@escyezi/dsh-enhance-plan-x')
    assertFeatureManifest(readJson('packages/source/package.json'), '@escyezi/dsh-enhance-source')
  })

  it('ships the source package with its native Schemastery config dependency', () => {
    const dependencies = readJson('packages/source/package.json')['dependencies'] as Record<string, string>
    expect(dependencies['@deepseek-ai/schemastery']).toBe('~3.18.5')
  })

  it('inserts one switchable row per feature package', () => {
    const patch = readText('cordis.patch.yml')
    expect(patch.match(/^    - id:/gmu)).toHaveLength(3)
    expect(patch).toContain('id: escyezi/dsh-enhance-balance')
    expect(patch).toContain('name: "@escyezi/dsh-enhance-balance"')
    expect(patch).toContain('balanceRefreshMs: 60000')
    expect(patch).toContain('id: escyezi/dsh-enhance-plan-x')
    expect(patch).toContain('name: "@escyezi/dsh-enhance-plan-x"')
    expect(patch).toContain('id: escyezi/dsh-enhance-source')
    expect(patch).toContain('name: "@escyezi/dsh-enhance-source"')
    expect(patch).not.toMatch(/^    - id: dsh-/gmu)

    const planXStart = patch.indexOf('id: escyezi/dsh-enhance-plan-x')
    const sourceStart = patch.indexOf('id: escyezi/dsh-enhance-source')
    expect(patch.slice(planXStart, sourceStart)).not.toContain('config:')
    const sourceBlock = patch.slice(sourceStart)
    expect(sourceBlock).toContain('config:')
    expect(sourceBlock).toContain('sourcePath: ""')
  })

  it('ships a title and a description in both locales', () => {
    const bundleTitles = { en: 'DSH Enhance', zh: 'DSH增强' } as const
    const balanceTitles = { en: 'Balance', zh: '余额' } as const
    const planXTitles = { en: 'Plan-X', zh: 'Plan-X 计划模式' } as const
    const sourceTitles = { en: 'Source Reference', zh: '源码参考' } as const
    for (const locale of ['en', 'zh'] as const) {
      const bundle = meta(`locale/${locale}.json`)
      expect(bundle['title']).toBe(bundleTitles[locale])
      expect(bundle['description']?.length).toBeGreaterThan(20)
      const balance = meta(`packages/balance/locale/${locale}.json`)
      expect(balance['title']).toBe(balanceTitles[locale])
      expect(balance['description']?.length).toBeGreaterThan(20)
      const planX = meta(`packages/plan-x/locale/${locale}.json`)
      expect(planX['title']).toBe(planXTitles[locale])
      expect(planX['description']?.length).toBeGreaterThan(20)
      const source = meta(`packages/source/locale/${locale}.json`)
      expect(source['title']).toBe(sourceTitles[locale])
      expect(source['description']?.length).toBeGreaterThan(20)
    }
  })

  it('keeps the client locale namespaces distinct', () => {
    expect(BALANCE_NS).toBe('escyezi.enhance.balance')
    expect(PLAN_X_NS).toBe('escyezi.enhance.planX')
    expect(SOURCE_NS).toBe('escyezi.enhance.source')
    expect(new Set([BALANCE_NS, PLAN_X_NS, SOURCE_NS]).size).toBe(3)
  })

  it('ships a valid standalone SVG icon for the bundle and all three rows', () => {
    for (const relative of [
      'icon.svg',
      'packages/balance/icon.svg',
      'packages/plan-x/icon.svg',
      'packages/source/icon.svg',
    ]) {
      const icon = readText(relative)
      expect(icon.startsWith('<svg')).toBe(true)
      expect(icon).toContain('viewBox="0 0 64 64"')
      expect(icon.trimEnd().endsWith('</svg>')).toBe(true)
    }
  })
})
