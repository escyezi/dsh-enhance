#!/bin/sh
# Build lib/index.js (Host half) and lib/client.js (browser half).
#
# The DSH client bundle preset locates a package by globbing
# <repo>/packages/*/*/package.json, so the build runs from a transient scaffold
# inside the repository that holds a copy of this directory's sources and
# manifest. The scaffold is removed again on exit; no tracked file in the
# repository is read for anything but the preset itself, and nothing there is
# written.
set -eu

PLUGIN="$(cd "$(dirname "$0")" && pwd)"
REPO="${DSH_REPO:?dsh-enhance: set DSH_REPO to a DSH source checkout}"
REPO="$(cd "$REPO" && pwd)"
SCAFFOLD="$REPO/packages/client/ui-dsh-enhance"
VERSION="${DSH_CLIENT_VERSION:-0.2.1-rc.2}"

if [ ! -f "$REPO/packages/client/tsdown.client.ts" ]; then
  echo "dsh-enhance: $REPO is not a DSH source checkout; set DSH_REPO to one" >&2
  exit 1
fi
if [ ! -x "$REPO/node_modules/.bin/tsdown" ]; then
  echo "dsh-enhance: $REPO/node_modules/.bin/tsdown is missing; install the checkout's dependencies" >&2
  exit 1
fi
if [ -e "$SCAFFOLD" ]; then
  echo "dsh-enhance: $SCAFFOLD already exists; remove it before building" >&2
  exit 1
fi

cleanup() { rm -rf "$SCAFFOLD"; }
trap cleanup EXIT INT TERM

mkdir -p "$SCAFFOLD"
cp "$PLUGIN/package.json" "$SCAFFOLD/package.json"
cp "$PLUGIN/tsdown.config.ts" "$SCAFFOLD/tsdown.config.ts"
cp -R "$PLUGIN/src" "$SCAFFOLD/src"
# Dependencies resolve from the checkout's own node_modules. Linking this
# project's node_modules would leak its absolute path into emitted comments and
# source maps.

cd "$REPO"
# The client build inlines DSH_CLIENT_* values; the product version is the one
# this plugin reports to the Platform as its calling client.
# The repository's own tsdown binary is invoked directly: `pnpm exec` here would
# run the repository's pinned pnpm, whose dependency-status check picks up this
# transient package and tries to install the whole workspace.
DSH_CLIENT_VERSION="$VERSION" "$REPO/node_modules/.bin/tsdown" \
  --config-loader native --config "$SCAFFOLD/tsdown.config.ts"

# The CSS-module loader names its virtual module after the physical stylesheet
# path. Replace the checkout path in emitted comments and maps so the browser
# bundle carries no machine-specific path.
node - "$SCAFFOLD/lib" "$REPO" <<'EOF'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const [dir, repo] = process.argv.slice(2)
for (const name of readdirSync(dir)) {
  if (!/\.(?:js|map)$/u.test(name)) continue
  const file = join(dir, name)
  const source = readFileSync(file, 'utf8')
  const clean = source.replaceAll(repo, '<dsh-repo>')
  if (clean !== source) writeFileSync(file, clean)
}
EOF

rm -rf "$PLUGIN/lib"
cp -R "$SCAFFOLD/lib" "$PLUGIN/lib"
echo "dsh-enhance: built $PLUGIN/lib ($(ls "$PLUGIN/lib" | tr '\n' ' '))"
