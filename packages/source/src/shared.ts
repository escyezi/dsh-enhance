/**
 * Shared vocabulary of the source-reference feature.
 *
 * This module is safe for both halves: it contains only constants and types,
 * so the browser bundle can import the constants it needs without pulling in
 * Host-only modules. The Host and Client use the same wire shapes here.
 *
 * @module
 */

/** Feature package name; also the browser module id. */
export const SOURCE_PACKAGE = '@escyezi/dsh-enhance-source'

/** Bundle package that declares the row; the row-config slot key uses this name. */
export const SOURCE_BUNDLE = '@escyezi/dsh-enhance'

/** Row id exactly as the bundle patch declares it. */
export const SOURCE_ROW_ID = 'escyezi/dsh-enhance-source'

/** Key of the row configuration slot: `<bundle package>#<row id>`. */
export const SOURCE_ROW_KEY = `${SOURCE_BUNDLE}#${SOURCE_ROW_ID}`

/** Host route path checked by the web server. */
export const SOURCE_INSPECT_PATH = '/dsh-enhance/source/inspect'

/** Browser-relative form of {@link SOURCE_INSPECT_PATH}. */
export const SOURCE_INSPECT_ROUTE = SOURCE_INSPECT_PATH.slice(1)

/** Host route path checked by the web server. */
export const SOURCE_UPDATE_PATH = '/dsh-enhance/source/update'

/** Browser-relative form of {@link SOURCE_UPDATE_PATH}. */
export const SOURCE_UPDATE_ROUTE = SOURCE_UPDATE_PATH.slice(1)

/** Host route path checked by the web server. */
export const SOURCE_UPDATE_STATUS_PATH = '/dsh-enhance/source/update/status'

/** Browser-relative form of {@link SOURCE_UPDATE_STATUS_PATH}. */
export const SOURCE_UPDATE_STATUS_ROUTE = SOURCE_UPDATE_STATUS_PATH.slice(1)

/** Release tag prefix used by the DSH repository (`dsh-v0.2.1-rc.2`). */
export const DSH_TAG_PREFIX = 'dsh-v'

/** Where the Host learned the running DSH version. */
export type RuntimeVersionSource = 'env' | 'installed'

/** The running DSH runtime version detected on this Host. */
export interface RuntimeVersion {
  /** Version such as `0.2.1-rc.2`. */
  version: string
  /** `env` for `DSH_CLIENT_VERSION`; `installed` for an installed package manifest. */
  source: RuntimeVersionSource
}

/** One inspected local source checkout plus the Host's runtime-version fact. */
export interface SourceInspection {
  /** Configured path, trimmed. */
  path: string
  /** Whether the path exists. */
  exists: boolean
  /** Whether the path is a directory (when it exists). */
  directory: boolean
  /** Whether `packages/client/tsdown.client.ts` exists, i.e. this is a DSH checkout. */
  checkout: boolean
  /** `package.json` version of the checkout, when readable. */
  version?: string
  /** Current branch name; absent for a detached HEAD. */
  branch?: string
  /** Exact tag at HEAD (`git describe --tags --exact-match`), when one exists. */
  tag?: string
  /** Short HEAD object id. */
  head?: string
  /** Upstream ref such as `origin/master`, when tracked. */
  upstream?: string
  /** Commits ahead of the upstream. */
  ahead?: number
  /** Commits behind the upstream. */
  behind?: number
  /** Whether HEAD is detached. */
  detached?: boolean
  /** Whether the worktree has uncommitted changes. */
  dirty?: boolean
  /** Whether `git status` succeeded (i.e. this is a working git repository). */
  gitRepository?: boolean
  /** Whether `node_modules/.bin/tsdown` exists. */
  dependenciesInstalled: boolean
  /** Git failure text when status/describe could not run. */
  gitError?: string
  /** Structural problem with the configured path. */
  error?: 'not-absolute' | 'not-found' | 'not-directory' | 'not-checkout'
  /** Running DSH version; attached by the inspect route, not by the resolver. */
  runtimeVersion?: RuntimeVersion
}

/** The two update targets the page offers. */
export type UpdateAction = 'latest' | 'version'

/** What one update action aims at, once resolved. */
export type UpdateTarget =
  | { kind: 'branch'; name: string }
  | { kind: 'tag'; name: string }

/** Update request body; the Host resolves the runtime version itself. */
export type SourceUpdateRequest =
  | { action: 'latest' }
  | { action: 'version' }

/** One in-memory update job. */
export interface UpdateStatus {
  /** Action that produced this job. */
  action: UpdateAction
  /** Resolved target, available once the action resolves a branch or tag. */
  target?: UpdateTarget
  /** Job phase. */
  phase: 'running' | 'succeeded' | 'failed'
  /** Git transcript, command lines and combined output, capped to a tail. */
  output: string
  /** Whether HEAD moved; absent while running. */
  changed?: boolean
  /** Exit code of the failing step, when one is known. */
  exitCode?: number | null
  /** Inspection taken before the action. */
  before?: SourceInspection
  /** Inspection taken after a successful action. */
  after?: SourceInspection
  /** Warning when the worktree was dirty at start. */
  warning?: 'dirty'
  /** Failure detail. */
  error?: { code: SourceErrorCode; message: string }
}

/** Error codes the Host route reports. */
export type SourceErrorCode =
  | 'bad-request'
  | 'busy'
  | 'unknown-action'
  | 'not-configured'
  | 'not-absolute'
  | 'not-found'
  | 'not-directory'
  | 'not-checkout'
  | 'not-git'
  | 'git-missing'
  | 'git-timeout'
  | 'git-failed'
  | 'checkout-failed'
  | 'tag-not-found'
  | 'no-default-branch'
  | 'runtime-version-unavailable'
  | 'runtime-version-invalid'
  | 'internal'
