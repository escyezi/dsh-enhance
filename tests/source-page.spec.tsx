// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SourceConfigInjected, SourceConfigPageProps } from '../packages/source/src/client/SourceConfigPage.tsx'
import { SourceConfigPage } from '../packages/source/src/client/SourceConfigPage.tsx'
import { zh } from '../packages/source/src/client/locales.ts'
import type { SourceInspection, UpdateStatus } from '../packages/source/src/shared.ts'
import type { InspectResult, StartUpdateResult } from '../packages/source/src/client/controller.ts'

afterEach(cleanup)

function translate(key: string, params?: Record<string, string>): string {
  const template = String((zh as Record<string, string>)[key] ?? key)
  return template.replace(/\{(\w+)\}/g, (_match: string, name: string) => params?.[name] ?? `{${name}}`)
}

const inspection: SourceInspection = {
  path: '/src',
  exists: true,
  directory: true,
  checkout: true,
  version: '0.2.1-rc.2',
  branch: 'master',
  tag: 'dsh-v0.2.1-rc.2',
  head: '12345678',
  upstream: 'origin/master',
  ahead: 0,
  behind: 0,
  detached: false,
  dirty: false,
  gitRepository: true,
  dependenciesInstalled: true,
  runtimeVersion: { version: '0.2.1-rc.2', source: 'env' },
}

interface Harness {
  props: SourceConfigPageProps
  mutate: ReturnType<typeof vi.fn>
  inspect: ReturnType<typeof vi.fn>
  startUpdate: ReturnType<typeof vi.fn>
  updateStatus: ReturnType<typeof vi.fn>
}

function harness(options: {
  view?: 'page' | 'summary'
  inspection?: SourceInspection | undefined
  mutateAccepted?: boolean
  updateStatus?: (id: string) => Promise<UpdateStatus | null>
  pickDirectory?: (() => Promise<string | null>) | null
  form?: boolean
} = {}): Harness {
  const mutate = vi.fn(async () => options.mutateAccepted ?? true)
  const inspect = vi.fn(async (): Promise<InspectResult> => ({
    ok: true,
    value: options.inspection ?? inspection,
  }))
  const startUpdate = vi.fn(async (): Promise<StartUpdateResult> => ({ ok: true, id: 'job-1' }))
  const updateStatus = vi.fn(options.updateStatus ?? (async () => ({
    action: 'latest' as const,
    phase: 'succeeded' as const,
    changed: true,
    output: 'done',
  })))
  const injected: SourceConfigInjected = {
    inspect,
    startUpdate,
    updateStatus,
    pickDirectory: options.pickDirectory ?? null,
  }
  const form = options.form === false
    ? undefined
    : {
        state: {
          status: 'ready',
          value: { sourcePath: '/src' },
          base: undefined,
          user: undefined,
          revision: 1,
          writable: true,
        },
        mutate,
      }
  const props = {
    view: options.view ?? 'page',
    form,
    t: translate,
    ...injected,
  } as unknown as SourceConfigPageProps
  return { props, mutate, inspect, startUpdate, updateStatus }
}

describe('SourceConfigPage shell', () => {
  it('renders a summary line for the row detail fallback', () => {
    const { props } = harness({ view: 'summary' })
    render(<SourceConfigPage {...props} />)
    expect(screen.getByText(/本地 DSH 源码参考/)).toBeDefined()
    expect(screen.getByText(/\/src/)).toBeDefined()
  })

  it('shows loading and unavailable states without editable controls', () => {
    const loading = harness({ form: false })
    const { unmount } = render(<SourceConfigPage {...loading.props} />)
    expect(screen.getByText('当前环境不能编辑该配置')).toBeDefined()
    unmount()
  })

  it('renders the path, source version, runtime version, and checkout status', async () => {
    const { props, inspect } = harness()
    render(<SourceConfigPage {...props} />)
    await waitFor(() => { expect(inspect).toHaveBeenCalled() })
    expect(screen.getByDisplayValue('/src')).toBeDefined()
    await waitFor(() => { expect(screen.getByText('DSH 源码 checkout')).toBeDefined() })
    expect(screen.getByText('0.2.1-rc.2 (来自运行环境)')).toBeDefined()
    expect(screen.getByText('源码版本与运行时版本一致')).toBeDefined()
  })

  it('shows the runtime version mismatch warning', async () => {
    const { props } = harness({
      inspection: {
        ...inspection,
        version: '0.2.0',
        runtimeVersion: { version: '0.2.1-rc.2', source: 'env' },
      },
    })
    render(<SourceConfigPage {...props} />)
    await waitFor(() => { expect(screen.getByText(/源码版本与运行时版本不一致/)).toBeDefined() })
  })

  it('reports a dirty git worktree as a warning', async () => {
    const { props } = harness({ inspection: { ...inspection, dirty: true } })
    render(<SourceConfigPage {...props} />)
    await waitFor(() => { expect(screen.getByText(/git 工作区有未提交修改/)).toBeDefined() })
  })
})

describe('SourceConfigPage saving', () => {
  it('saves the trimmed draft with the revision the page read', async () => {
    const { props, mutate } = harness()
    render(<SourceConfigPage {...props} />)
    const input = screen.getByDisplayValue('/src')
    fireEvent.change(input, { target: { value: '  /new/source  ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        [{ op: 'set', path: ['sourcePath'], value: '/new/source' }],
        1,
      )
    })
    await waitFor(() => { expect(screen.getByText('已保存')).toBeDefined() })
  })

  it('shows the failure state when the Host refuses the write', async () => {
    const { props } = harness({ mutateAccepted: false })
    render(<SourceConfigPage {...props} />)
    fireEvent.change(screen.getByDisplayValue('/src'), { target: { value: '/new' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => { expect(screen.getByText('保存失败')).toBeDefined() })
  })

  it('writes a chosen directory into the draft without saving it', async () => {
    const pickDirectory = vi.fn(async () => '/picked/source')
    const { props, mutate } = harness({ pickDirectory })
    render(<SourceConfigPage {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '选择目录' }))
    await waitFor(() => { expect(screen.getByDisplayValue('/picked/source')).toBeDefined() })
    expect(mutate).not.toHaveBeenCalled()
  })
})

describe('SourceConfigPage updates', () => {
  it('starts latest with the action only and renders the settled log', async () => {
    const { props, startUpdate } = harness()
    render(<SourceConfigPage {...props} />)
    await waitFor(() => { expect((screen.getByRole('button', { name: '更新到最新' }) as HTMLButtonElement).disabled).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: '更新到最新' }))
    await waitFor(() => { expect(startUpdate).toHaveBeenCalledWith({ action: 'latest' }) })
    await waitFor(() => { expect(screen.getByText(/更新完成/)).toBeDefined() })
    expect(screen.getByLabelText('输出').textContent).toContain('done')
  })

  it('starts the version action without a version argument', async () => {
    const { props, startUpdate } = harness()
    render(<SourceConfigPage {...props} />)
    await waitFor(() => { expect((screen.getByRole('button', { name: /更新到当前版本/ }) as HTMLButtonElement).disabled).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: /更新到当前版本/ }))
    await waitFor(() => { expect(startUpdate).toHaveBeenCalledWith({ action: 'version' }) })
  })

  it('disables the version button when no runtime version is detected', async () => {
    const { props } = harness({ inspection: { ...inspection, runtimeVersion: undefined } })
    render(<SourceConfigPage {...props} />)
    await waitFor(() => { expect(screen.getByText('无法确定本机 DSH 运行时版本')).toBeDefined() })
    const button = screen.getByRole('button', { name: /更新到当前版本/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('title')).toContain('无法确定本机 DSH 运行时版本')
  })

  it('disables updates while the path draft is unsaved', async () => {
    const { props } = harness()
    render(<SourceConfigPage {...props} />)
    fireEvent.change(screen.getByDisplayValue('/src'), { target: { value: '/other' } })
    expect((screen.getByRole('button', { name: '更新到最新' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /更新到当前版本/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps polling until the job settles', async () => {
    const running: UpdateStatus = { action: 'latest', phase: 'running', output: '$ git fetch\nfetching' }
    const succeeded: UpdateStatus = { action: 'latest', phase: 'succeeded', changed: true, output: 'complete' }
    let calls = 0
    const { props } = harness({
      updateStatus: async () => {
        calls += 1
        return calls === 1 ? running : succeeded
      },
    })
    render(<SourceConfigPage {...props} />)
    await waitFor(() => { expect((screen.getByRole('button', { name: '更新到最新' }) as HTMLButtonElement).disabled).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: '更新到最新' }))
    await waitFor(() => { expect(screen.getByText(/更新完成/)).toBeDefined() }, { timeout: 2500 })
    expect(screen.getByLabelText('输出').textContent).toContain('complete')
  })
})
