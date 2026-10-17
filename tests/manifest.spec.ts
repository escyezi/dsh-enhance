import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NS } from '../src/client/locales.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, relative), 'utf8')) as Record<string, unknown>
}

describe('bundle display resources', () => {
  it('declares the bundle patch and the browser half', () => {
    const manifest = readJson('package.json')
    const dsh = manifest['dsh'] as Record<string, unknown>
    expect(manifest['name']).toBe('@escyezi/dsh-enhance')
    expect(dsh['bundle']).toEqual({ patch: './cordis.patch.yml' })
    expect(dsh['client']).toEqual({ platform: 'web' })
    expect((manifest['exports'] as Record<string, unknown>)['./icon']).toBe('./icon.svg')
    expect((manifest['exports'] as Record<string, unknown>)['./locale/*.json']).toBe('./locale/*.json')
    expect((manifest['files'] as string[])).toEqual(
      expect.arrayContaining(['lib/**', 'cordis.patch.yml', 'locale/*.json', 'icon.svg']),
    )
  })

  it('ships a title and a description in both locales', () => {
    const titles = { en: 'DSH Enhance', zh: 'DSH增强' } as const
    for (const locale of ['en', 'zh'] as const) {
      const meta = readJson(`locale/${locale}.json`)['meta'] as Record<string, string>
      expect(meta['title']).toBe(titles[locale])
      expect(meta['description']?.length).toBeGreaterThan(20)
    }
  })

  it('keeps the package name scope and the locale namespace aligned', () => {
    expect(NS).toBe('escyezi.enhance')
  })

  it('ships a valid standalone SVG icon', () => {
    expect(existsSync(join(ROOT, 'icon.svg'))).toBe(true)
    const icon = readFileSync(join(ROOT, 'icon.svg'), 'utf8')
    expect(icon.startsWith('<svg')).toBe(true)
    expect(icon).toContain('viewBox="0 0 64 64"')
    expect(icon).toContain('</svg>')
  })

  it('ships the patch row this plugin owns', () => {
    const patch = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8')
    expect(patch).toContain('id: dsh-enhance')
    expect(patch).toContain('name: "@escyezi/dsh-enhance"')
    expect(patch).toContain('balanceRefreshMs: 60000')
  })
})
