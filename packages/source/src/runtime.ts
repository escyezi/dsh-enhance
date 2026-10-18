/**
 * Running DSH runtime version detection.
 *
 * The Desktop launches its Host process with `DSH_CLIENT_VERSION` set to the
 * application build version (the same value the Web bundle uses for telemetry),
 * so the environment is the authoritative answer in the normal Desktop
 * installation. CLI/Web deployments that do not set it fall back to the
 * installed runtime package manifest through the profile package lookup.
 *
 * @module
 */
import type { Context } from '@deepseek-ai/cordis'
import type { RuntimeVersion } from './shared.ts'

/** Strict-enough semver used before a version becomes a release tag. */
export const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/

/** Inputs of {@link detectRuntimeVersion}; injected so tests need no process or Cordis. */
export interface RuntimeVersionDeps {
  /** Raw `DSH_CLIENT_VERSION` value, when the process has one. */
  env?: string | undefined
  /** Resolution base used for the installed-package fallback. */
  baseUrl?: string | undefined
  /** Read one installed package's manifest version. */
  packageVersion: (name: string, baseUrl: string) => string | undefined
}

/**
 * Detect the running DSH version without guessing.
 * @param deps - environment value, resolution base, and installed-package reader.
 * @returns the version and where it came from, or undefined when neither source
 *   yields a well-formed version.
 */
export function detectRuntimeVersion(deps: RuntimeVersionDeps): RuntimeVersion | undefined {
  const env = deps.env?.trim()
  if (env !== undefined && env !== '' && SEMVER.test(env)) return { version: env, source: 'env' }
  if (deps.baseUrl === undefined || deps.baseUrl === '') return undefined
  for (const name of ['@deepseek-ai/dsh', '@deepseek-ai/dsh-system-prompt']) {
    const version = deps.packageVersion(name, deps.baseUrl)?.trim()
    if (version !== undefined && version !== '' && SEMVER.test(version)) {
      return { version, source: 'installed' }
    }
  }
  return undefined
}

/** The subset of `pluginPackages` this feature reads. */
interface PackageLookup {
  packageOf(name: string, parentURL: string): { version?: string } | undefined
}

/** Loader-entry shape carrying the tree's resolution base. */
interface FiberEntryShape {
  entry?: {
    parent?: {
      tree?: {
        ctx?: { baseUrl?: string }
      }
    }
  }
}

/**
 * Build a resolver for the running DSH version.
 * @param ctx - Host context; `pluginPackages` and the Loader entry base are read lazily.
 * @returns a function evaluated on each call, so a late service or a changed
 *   environment is observed instead of a cached failure.
 */
export function createRuntimeVersionResolver(ctx: Context): () => RuntimeVersion | undefined {
  let packages: PackageLookup | undefined
  ctx.inject(['pluginPackages'], (capCtx) => {
    packages = Reflect.get(capCtx, 'pluginPackages') as PackageLookup
    return () => { packages = undefined }
  })

  return () => {
    const fiber = (ctx as unknown as { fiber?: FiberEntryShape }).fiber
    const baseUrl = ctx.baseUrl ?? fiber?.entry?.parent?.tree?.ctx?.baseUrl
    return detectRuntimeVersion({
      env: process.env.DSH_CLIENT_VERSION,
      baseUrl,
      packageVersion: (name, url) => {
        try {
          return packages?.packageOf(name, url)?.version
        } catch {
          // A resolution service that cannot answer is the same as no answer.
          return undefined
        }
      },
    })
  }
}
