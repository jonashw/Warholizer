import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// The raster engine depends on real Canvas 2D (OffscreenCanvas, filters,
// compositing), so tests run in a real headless Chromium, not jsdom.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
}))
