/**
 * Bundle recipes for both halves, using the DSH repository's client preset.
 *
 * This file is written for the transient scaffold `build.sh` creates at
 * `<repo>/packages/client/ui-dsh-enhance`: the preset reads a package's manifest
 * from `packages/*\/*\/package.json`, so the build must run from a directory
 * there. The `../tsdown.client.ts` import resolves only in that location.
 */
import { clientBundle } from '../tsdown.client.ts'

export default clientBundle('@escyezi/dsh-enhance', ['src/index.ts'])
