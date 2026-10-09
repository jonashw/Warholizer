import { defineConfig, mergeConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import viteConfig from './vite.config.ts'

// The raster engine depends on real Canvas 2D (OffscreenCanvas, filters, compositing), so app
// tests run in a real headless Chromium, not jsdom. Server code (api/) is tested in Node.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        test: {
          name: 'node',
          include: ['api/**/*.test.mts'],
          environment: 'node',
        },
      },
    ],
  },
}))
