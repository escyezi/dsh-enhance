import { defineConfig } from 'vitest/config'

/** Pure-fold specs run in node; component specs opt into jsdom with a per-file pragma. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
})
