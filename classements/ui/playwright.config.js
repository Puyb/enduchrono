const { defineConfig, devices } = require('@playwright/test')

const uiBaseUrl = process.env.CLASSEMENTS_UI_URL || 'http://localhost:8080'

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 90 * 1000,
  expect: {
    timeout: 6 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: uiBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
})
