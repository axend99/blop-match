import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

// End-to-end run with 10 scripted participants (e2e/). It runs against PRODUCTION by default
// and creates real accounts (blopmatch+e2e01…10@gmail.com); clean with `npm run e2e:clean`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://blop-match.vercel.app',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
  },
});
