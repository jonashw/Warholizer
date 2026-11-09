import { defineConfig } from 'vitest/config'

// Node tests: the pages run against node:sqlite with the real migrations and seed SQL.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], environment: 'node' } })
