import { defineConfig } from '@playwright/test';
import type { ApiTestOptions } from './tests/support/inventory.js';

const baseURL = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig<ApiTestOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: 'never',
        title: 'Inventory API Quality Lab',
      },
    ],
  ],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'dev', use: { environmentName: 'dev' } },
    { name: 'prod', use: { environmentName: 'prod' } },
  ],
});



