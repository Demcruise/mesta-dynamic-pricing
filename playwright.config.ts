import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
