import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests/e2e',
  // Rebuilds the demo workspace so every run starts from the same data.
  globalSetup: './tests/e2e/support/global-setup.ts',
  // The demo workspace is shared state: run the specs one after another.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    // The production build: what Vercel serves. AI runs on the heuristics (no key in tests).
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { ANTHROPIC_API_KEY: '', NEXT_PUBLIC_DEMO_ENABLED: 'true', SITE_URL: `http://localhost:${PORT}` },
  },
});
