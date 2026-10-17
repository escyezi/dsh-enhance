/**
 * Bundle recipe for the Plan-X feature, using the DSH repository's client
 * preset.
 *
 * This file is written for the transient scaffold `build.sh` creates at
 * `<repo>/packages/client/ui-dsh-enhance-plan-x`. The preset reads the package
 * manifest relative to `import.meta.dirname` and uses its `name` as the client
 * id; the `../tsdown.client.ts` import resolves only in that location.
 */
import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(import.meta.dirname, ['src/index.ts'])
