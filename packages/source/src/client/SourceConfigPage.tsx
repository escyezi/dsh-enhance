/**
 * Row configuration page for the source-reference feature.
 *
 * The page owns its draft and save control; the Plugins page owner supplies the
 * accepted Host values (`form.state`) and the revision-fenced write
 * (`form.mutate`). The configured path and runtime version stay on the Host:
 * inspect and update requests carry no path, and the version action carries no
 * version.
 *
 * @module
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: declares the `plugins.row.config` slot and its owner props.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { SourceErrorCode, SourceInspection, SourceUpdateRequest, UpdateStatus } from '../shared.ts'
import type { InspectResult, StartUpdateResult } from './controller.ts'
import { NS, type SourceKey } from './locales.ts'
import css from './SourceConfigPage.module.css'

/** Operations the browser half injects into the page. */
export interface SourceConfigInjected {
  /** Inspect the configured checkout and the Host-detected runtime version. */
  inspect: () => Promise<InspectResult>
  /** Start an update job. */
  startUpdate: (request: SourceUpdateRequest) => Promise<StartUpdateResult>
  /** Poll one update job. */
  updateStatus: (id: string) => Promise<UpdateStatus | null>
  /** Native directory picker, or null when the environment has none. */
  pickDirectory: (() => Promise<string | null>) | null
}

/** Full props of the configuration page. */
export type SourceConfigPageProps =
  PropsRuntime<'plugins.row.config'> & PropsLocale<typeof NS> & InjectFace<SourceConfigInjected>

type SourceT = SourceConfigPageProps['t']

const ERROR_KEYS: Partial<Record<SourceErrorCode, SourceKey>> = {
  busy: 'source.errorBusy',
  'not-configured': 'source.errorNotConfigured',
  'not-checkout': 'source.errorNotCheckout',
  'runtime-version-unavailable': 'source.errorRuntimeVersionUnavailable',
  'runtime-version-invalid': 'source.errorRuntimeVersionInvalid',
  'tag-not-found': 'source.errorTagNotFound',
  'no-default-branch': 'source.errorNoDefaultBranch',
  'git-missing': 'source.errorGitMissing',
  'git-failed': 'source.errorGitFailed',
  'git-timeout': 'source.errorGitFailed',
}

function errorText(t: SourceT, code: string | undefined, message: string): string {
  const key = code === undefined ? undefined : ERROR_KEYS[code as SourceErrorCode]
  return key === undefined ? `${t('source.errorGeneric')}: ${message}` : `${t(key)}: ${message}`
}

function runtimeLabel(t: SourceT, inspection: SourceInspection): string {
  const runtime = inspection.runtimeVersion
  if (runtime === undefined) return t('source.runtimeVersionUnavailable')
  const source = runtime.source === 'env'
    ? t('source.runtimeVersionSourceEnv')
    : t('source.runtimeVersionSourceInstalled')
  return `${runtime.version} (${source})`
}

function Fact({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className={css.fact}>
      <dt className={css.factLabel}>{label}</dt>
      <dd className={css.factValue}>{children}</dd>
    </div>
  )
}

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'error'; children: ReactNode }): ReactNode {
  return <span className={`${css.badge} ${tone === 'ok' ? css.badgeOk : tone === 'warn' ? css.badgeWarn : css.badgeError}`}>{children}</span>
}

function InspectionFacts({
  inspection,
  t,
}: {
  inspection: SourceInspection
  t: SourceT
}): ReactNode {
  const source = inspection.version
  const runtime = inspection.runtimeVersion?.version
  const matched = source !== undefined && runtime !== undefined ? source === runtime : undefined
  return (
    <>
      <div className={css.badges}>
        <Badge tone={inspection.exists ? 'ok' : 'error'}>
          {inspection.exists ? t('source.exists') : t('source.missing')}
        </Badge>
        {inspection.exists && (
          <Badge tone={inspection.checkout ? 'ok' : 'error'}>
            {inspection.checkout ? t('source.checkout') : t('source.notCheckout')}
          </Badge>
        )}
        {inspection.dirty === true && <Badge tone="warn">{t('source.dirty')}</Badge>}
        {inspection.error === 'not-absolute' && <Badge tone="error">{t('source.notAbsolute')}</Badge>}
      </div>
      <dl className={css.facts}>
        <Fact label={t('source.sourceVersion')}>{source ?? '—'}</Fact>
        <Fact label={t('source.runtimeVersion')}>{runtimeLabel(t, inspection)}</Fact>
        <Fact label={t('source.branch')}>{inspection.branch ?? (inspection.detached === true ? t('source.detached') : '—')}</Fact>
        <Fact label={t('source.tag')}>{inspection.tag ?? '—'}</Fact>
        <Fact label={t('source.head')}>{inspection.head ?? '—'}</Fact>
        <Fact label={t('source.upstream')}>{inspection.upstream ?? '—'}</Fact>
        {inspection.ahead !== undefined && inspection.behind !== undefined && (
          <Fact label={t('source.aheadBehindLabel')}>
            {t('source.aheadBehind', { ahead: String(inspection.ahead), behind: String(inspection.behind) })}
          </Fact>
        )}
        <Fact label={t('source.dirty')}>
          {inspection.dirty === true ? t('source.dirty') : inspection.dirty === false ? t('source.clean') : '—'}
        </Fact>
        <Fact label={t('source.depsInstalled')}>
          {inspection.dependenciesInstalled ? t('source.depsInstalled') : t('source.depsMissing')}
        </Fact>
      </dl>
      {matched === true && <p className={css.ok} role="status">{t('source.versionMatched')}</p>}
      {matched === false && <p className={css.warn} role="status">{t('source.versionMismatch')}</p>}
      {inspection.gitError !== undefined && (
        <p className={css.error} role="status">{t('source.gitError')}: {inspection.gitError}</p>
      )}
    </>
  )
}

function UpdateResult({ status, t }: { status: UpdateStatus; t: SourceT }): ReactNode {
  const settled = status.phase === 'succeeded'
  const label = status.phase === 'running'
    ? t('source.updating')
    : status.phase === 'failed'
      ? t('source.updateFailed')
      : status.changed === false
        ? status.action === 'latest' ? t('source.alreadyUpToDate') : t('source.alreadyOnVersion')
        : t('source.updateDone')
  const target = status.target === undefined
    ? ''
    : status.target.kind === 'branch'
      ? `${t('source.branch')}: ${status.target.name}`
      : `${t('source.tag')}: ${status.target.name}`
  return (
    <div className={css.result}>
      <p className={settled ? css.ok : status.phase === 'failed' ? css.error : css.hint} role="status">
        {label}{target === '' ? '' : ` · ${target}`}
      </p>
      {status.error !== undefined && <p className={css.error} role="status">{status.error.message}</p>}
      <pre className={css.log} aria-label={t('source.log')}>{status.output === '' ? '…' : status.output}</pre>
    </div>
  )
}

/**
 * Render the row configuration page.
 * @param props - Plugins page owner props (`view`, `form`), localized copy, and
 *   the injected inspect/update/picker operations.
 * @returns the summary line or the full page.
 */
export function SourceConfigPage(props: SourceConfigPageProps): ReactNode {
  const { view, form, t, inspect, startUpdate, updateStatus, pickDirectory } = props
  const state = form?.state
  const savedValue = typeof state?.value?.sourcePath === 'string' ? state.value.sourcePath : ''
  const [savedPath, setSavedPath] = useState(savedValue)
  const [draft, setDraft] = useState(savedValue)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [inspection, setInspection] = useState<SourceInspection | undefined>(undefined)
  const [inspecting, setInspecting] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | undefined>(undefined)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const pathId = useId()
  const pathHintId = useId()

  const aliveRef = useRef(true)
  const formRef = useRef(form)
  const tRef = useRef(t)
  const inspectRef = useRef(inspect)
  const startUpdateRef = useRef(startUpdate)
  const updateStatusRef = useRef(updateStatus)
  const savedPathRef = useRef(savedPath)
  const draftRef = useRef(draft)
  const retryPathRef = useRef<string | undefined>(undefined)
  formRef.current = form
  tRef.current = t
  inspectRef.current = inspect
  startUpdateRef.current = startUpdate
  updateStatusRef.current = updateStatus
  savedPathRef.current = savedPath
  draftRef.current = draft

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  // Keep the draft in step with an external configuration change while the
  // user has no unsaved edit of their own.
  useEffect(() => {
    if (draftRef.current.trim() === savedPathRef.current && savedValue !== savedPathRef.current) {
      setSavedPath(savedValue)
      setDraft(savedValue)
    }
  }, [savedValue])

  const runInspect = useCallback(async (retryPath?: string): Promise<void> => {
    if (savedPathRef.current === '') return
    setInspecting(true)
    setInspectError(null)
    const result = await inspectRef.current()
    if (!aliveRef.current) return
    if (!result.ok) {
      setInspecting(false)
      setInspectError(result.message)
      return
    }
    let value = result.value
    if (retryPath !== undefined && value.path !== retryPath) {
      await new Promise(resolve => setTimeout(resolve, 150))
      const retried = await inspectRef.current()
      if (!aliveRef.current) return
      if (retried.ok) value = retried.value
    }
    setInspection(value)
    setInspecting(false)
  }, [])

  useEffect(() => {
    if (savedPath === '') return
    const retry = retryPathRef.current
    retryPathRef.current = undefined
    void runInspect(retry)
  }, [savedPath, runInspect])

  useEffect(() => {
    if (jobId === null) return
    let active = true
    const tick = async (): Promise<void> => {
      const status = await updateStatusRef.current(jobId)
      if (!active) return
      if (status === null) {
        setUpdating(false)
        setJobId(null)
        setUpdateError(tRef.current('source.updateFailed'))
        return
      }
      setUpdate(status)
      if (status.phase !== 'running') {
        setUpdating(false)
        setJobId(null)
        void runInspect()
      }
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 1000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [jobId, runInspect])

  const save = async (): Promise<void> => {
    const current = formRef.current
    if (current === undefined || current.state.status !== 'ready' || current.state.writable !== true) return
    const value = draftRef.current.trim()
    setSaveState('saving')
    setSaveError(null)
    try {
      const accepted = await current.mutate(
        [{ op: 'set', path: ['sourcePath'], value }],
        current.state.revision,
      )
      if (!aliveRef.current) return
      if (!accepted) {
        setSaveState('failed')
        setSaveError(tRef.current('source.saveFailed'))
        return
      }
      setSaveState('saved')
      setSaveError(null)
      setInspection(undefined)
      retryPathRef.current = value
      setSavedPath(value)
      setDraft(value)
    } catch (error) {
      if (!aliveRef.current) return
      setSaveState('failed')
      setSaveError(error instanceof Error ? error.message : String(error))
    }
  }

  const choose = async (): Promise<void> => {
    if (pickDirectory === null) return
    setPickError(null)
    try {
      const chosen = await pickDirectory()
      if (!aliveRef.current || chosen === null) return
      setDraft(chosen)
      setSaveState('idle')
      setSaveError(null)
    } catch (error) {
      if (!aliveRef.current) return
      setPickError(error instanceof Error ? error.message : String(error))
    }
  }

  const start = async (action: 'latest' | 'version'): Promise<void> => {
    setUpdating(true)
    setUpdateError(null)
    setUpdate(undefined)
    setJobId(null)
    const result = await startUpdateRef.current({ action })
    if (!aliveRef.current) return
    if (!result.ok) {
      setUpdating(false)
      setUpdateError(errorText(tRef.current, result.code, result.message))
      return
    }
    setJobId(result.id)
  }

  if (view === 'summary') {
    return savedPath === '' ? t('source.notConfigured') : `${t('source.summary')}: ${savedPath}`
  }

  if (form === undefined) return <p className={css.notice}>{t('source.unavailable')}</p>
  if (state?.status === 'loading') return <p className={css.notice}>{t('source.loading')}</p>
  if (state?.status === 'unavailable') return <p className={css.notice}>{t('source.unavailable')}</p>

  const dirty = draft.trim() !== savedPath
  const editable = state?.status === 'ready' && state.writable === true
  const runtime = inspection?.runtimeVersion
  const gitReady = inspection?.checkout === true && inspection.gitRepository === true
  const busy = updating || jobId !== null
  const canUpdate = editable && savedPath !== '' && !dirty && gitReady && !busy
  const canUpdateVersion = canUpdate && runtime !== undefined
  const baseReason = savedPath === ''
    ? t('source.notConfigured')
    : dirty
      ? t('source.updateRequiresSave')
      : !editable
        ? t('source.unavailable')
        : !gitReady
          ? t('source.updateNotCheckout')
          : undefined
  const versionReason = runtime === undefined ? t('source.runtimeVersionUnavailable') : baseReason

  return (
    <div className={css.page}>
      <section className={css.section}>
        <h3 className={css.sectionTitle}>{t('source.title')}</h3>
        <p className={css.hint}>{t('source.description')}</p>

        <label className={css.label} htmlFor={pathId}>{t('source.pathLabel')}</label>
        <p className={css.hint} id={pathHintId}>{t('source.pathHint')}</p>
        <div className={css.pathRow}>
          <input
            id={pathId}
            className={`${css.input} ${css.mono}`}
            value={draft}
            placeholder={t('source.pathPlaceholder')}
            aria-describedby={pathHintId}
            spellCheck={false}
            autoComplete="off"
            disabled={!editable || saveState === 'saving' || busy}
            onChange={(event) => {
              setDraft(event.target.value)
              setSaveState('idle')
              setSaveError(null)
            }}
          />
          {pickDirectory !== null && (
            <button
              type="button"
              className={css.button}
              disabled={!editable || saveState === 'saving' || busy}
              onClick={() => { void choose() }}
            >
              {t('source.choose')}
            </button>
          )}
        </div>
        <div className={css.actions}>
          <button
            type="button"
            className={`${css.button} ${css.primary}`}
            disabled={!editable || !dirty || saveState === 'saving' || busy}
            onClick={() => { void save() }}
          >
            {saveState === 'saving' ? t('source.saving') : t('source.save')}
          </button>
          <button
            type="button"
            className={css.button}
            disabled={!editable || savedPath === '' || inspecting || busy}
            onClick={() => { void runInspect(savedPath) }}
          >
            {inspecting ? t('source.inspecting') : t('source.inspect')}
          </button>
          {saveState === 'saved' && <span className={css.ok} role="status">{t('source.saved')}</span>}
          {saveState === 'failed' && <span className={css.error} role="status">{saveError ?? t('source.saveFailed')}</span>}
        </div>
        {pickError !== null && <p className={css.error} role="status">{t('source.pickFailed')}: {pickError}</p>}

        {savedPath === '' && <p className={css.notice}>{t('source.notConfigured')}</p>}
        {savedPath !== '' && inspectError !== null && (
          <p className={css.error} role="status">{t('source.inspectFailed')}: {inspectError}</p>
        )}
        {savedPath !== '' && inspection === undefined && inspecting && (
          <p className={css.hint} role="status">{t('source.inspecting')}</p>
        )}
        {inspection !== undefined && <InspectionFacts inspection={inspection} t={t} />}
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>{t('source.update')}</h3>
        <p className={css.hint}>{t('source.updateHint')}</p>
        <div className={css.actions}>
          <button
            type="button"
            className={css.button}
            disabled={!canUpdate}
            title={baseReason}
            onClick={() => { void start('latest') }}
          >
            {t('source.updateLatest')}
          </button>
          <button
            type="button"
            className={css.button}
            disabled={!canUpdateVersion}
            title={versionReason}
            onClick={() => { void start('version') }}
          >
            {t('source.updateVersion', { version: runtime?.version ?? '?' })}
          </button>
        </div>
        <p className={css.hint}>
          {t('source.updateLatestHint')} {runtime === undefined ? '' : t('source.updateVersionHint', { version: runtime.version })}
        </p>
        {inspection?.dirty === true && <p className={css.warn} role="status">{t('source.dirtyWarning')}</p>}
        {updateError !== null && <p className={css.error} role="status">{updateError}</p>}
        {update !== undefined && <UpdateResult status={update} t={t} />}
      </section>
    </div>
  )
}
