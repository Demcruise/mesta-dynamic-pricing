import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  webServer: { command: `npx next dev -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 120_000 },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, grep: /@smoke/ },
  ],
});
