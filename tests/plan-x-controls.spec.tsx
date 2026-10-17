// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PlanXToggle, type PlanXToggleProps } from '../src/client/plan-x/PlanXToggle.tsx'
import { PlanBuildButton, type PlanBuildButtonProps } from '../src/client/plan-x/PlanBuildButton.tsx'
import { PlanXAutoOpen, type PlanXAutoOpenProps } from '../src/client/plan-x/PlanXAutoOpen.tsx'
import type { PlanXProjection } from '../src/plan-x/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

function translate(key: keyof typeof zh): string {
  return String(zh[key])
}

function toggleProps(
  projection: PlanXProjection,
  setActive: (active: boolean) => Promise<string | null> = async () => null,
): PlanXToggleProps {
  return {
    useProjection: (key: string) => key === 'planX' ? projection : undefined,
    setActive,
    t: translate,
  } as unknown as PlanXToggleProps
}

function buildProps(
  absolutePath: string,
  build: (path: string) => Promise<string | null> = async () => null,
): PlanBuildButtonProps {
  return { absolutePath, build, t: translate } as unknown as PlanBuildButtonProps
}

describe('PlanXToggle', () => {
  it('reflects the projected mode and switches it off', async () => {
    const setActive = vi.fn(async () => null)
    render(<PlanXToggle {...toggleProps({ active: true, document: null }, setActive)} />)
    const button = screen.getByRole('button', { name: '关闭 Plan-X 模式' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Plan-X')).toBeDefined()
    fireEvent.click(button)
    await waitFor(() => { expect(setActive).toHaveBeenCalledWith(false) })
  })

  it('switches an inactive mode on', async () => {
    const setActive = vi.fn(async () => null)
    render(<PlanXToggle {...toggleProps({ active: false, document: null }, setActive)} />)
    fireEvent.click(screen.getByRole('button', { name: '开启 Plan-X 模式' }))
    await waitFor(() => { expect(setActive).toHaveBeenCalledWith(true) })
  })

  it('shows a compact failure status', async () => {
    const setActive = vi.fn(async () => 'switch failed')
    render(<PlanXToggle {...toggleProps({ active: false, document: null }, setActive)} />)
    fireEvent.click(screen.getByRole('button', { name: '开启 Plan-X 模式' }))
    await waitFor(() => { expect(screen.getByRole('status').getAttribute('title')).toBe('switch failed') })
    expect(screen.getByRole('status').textContent).toBe('Plan-X 模式切换失败')
  })
})

describe('PlanBuildButton', () => {
  it('renders only for a Plan-X document and builds its relative path', async () => {
    const build = vi.fn(async () => null)
    render(<PlanBuildButton {...buildProps('/repo/project/.dsh/plans/dark-mode.plan.md', build)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Build' }))
    await waitFor(() => { expect(build).toHaveBeenCalledWith('.dsh/plans/dark-mode.plan.md') })
  })

  it('is absent from another Markdown file', () => {
    const { container } = render(<PlanBuildButton {...buildProps('/repo/project/notes.md')} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a failure status when the Build command fails', async () => {
    const build = vi.fn(async () => 'prompt rejected')
    render(<PlanBuildButton {...buildProps('/repo/project/.dsh/plans/dark-mode.plan.md', build) as PlanBuildButtonProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Build' }))
    await waitFor(() => { expect(screen.getByRole('status').getAttribute('title')).toBe('prompt rejected') })
    expect(screen.getByRole('status').textContent).toBe('执行失败: prompt rejected')
    expect((build as Mock).mock.calls).toHaveLength(1)
  })
})

interface HarnessProps {
  projection: PlanXProjection
  openDocument: (path: string) => void
}

function AutoOpenHarness({ projection, openDocument }: HarnessProps) {
  return (
    <PlanXAutoOpen
      {...({ useProjection: () => projection, openDocument } as unknown as PlanXAutoOpenProps)}
    />
  )
}

describe('PlanXAutoOpen', () => {
  it('does not reopen the document already present when the session mounts', () => {
    const openDocument = vi.fn()
    const projection: PlanXProjection = {
      active: true,
      document: { path: '.dsh/plans/old.plan.md', revision: 1 },
    }
    render(<AutoOpenHarness projection={projection} openDocument={openDocument} />)
    expect(openDocument).not.toHaveBeenCalled()
  })

  it('opens a document written after mount', () => {
    const openDocument = vi.fn()
    const { rerender } = render(
      <AutoOpenHarness projection={{ active: true, document: null }} openDocument={openDocument} />,
    )
    rerender(
      <AutoOpenHarness
        projection={{ active: true, document: { path: '.dsh/plans/new.plan.md', revision: 1 } }}
        openDocument={openDocument}
      />,
    )
    expect(openDocument).toHaveBeenCalledWith('.dsh/plans/new.plan.md')
  })

  it('opens each new revision once', () => {
    const openDocument = vi.fn()
    const { rerender } = render(
      <AutoOpenHarness
        projection={{ active: true, document: { path: '.dsh/plans/new.plan.md', revision: 1 } }}
        openDocument={openDocument}
      />,
    )
    rerender(
      <AutoOpenHarness
        projection={{ active: true, document: { path: '.dsh/plans/new.plan.md', revision: 2 } }}
        openDocument={openDocument}
      />,
    )
    rerender(
      <AutoOpenHarness
        projection={{ active: true, document: { path: '.dsh/plans/new.plan.md', revision: 2 } }}
        openDocument={openDocument}
      />,
    )
    expect(openDocument).toHaveBeenCalledTimes(1)
    expect(openDocument).toHaveBeenCalledWith('.dsh/plans/new.plan.md')
  })
})
