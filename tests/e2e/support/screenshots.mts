// Captures the README screenshots from a running server: `node tests/e2e/support/screenshots.mts [baseURL]`.
// Run after reset_demo() so the demo data is in its initial state.
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3100';
const ORG = '/o/de000000-0000-4000-8000-000000000001';
const out = (name: string) => `docs/screenshots/${name}.png`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });

await page.goto(`${base}/`);
await page.screenshot({ path: out('landing') });

await page.goto(`${base}/login`);
await page.getByRole('button', { name: 'Demo as owner' }).click();
await page.waitForURL(`**${ORG}`);

// Score the leads first, Maya included, so the dashboard's "Hottest leads" list matches the contact screenshot.
for (const name of ['dr. Maya Putri', 'Dewi Lestari', 'Yusuf Pratama', 'Hendra Gunawan']) {
  await page.goto(`${base}${ORG}/contacts`);
  await page.getByRole('link', { name }).click();
  await page.getByRole('button', { name: 'Score lead' }).click();
  await page.getByText('/ 100').waitFor();
}
await page.goto(`${base}${ORG}`);
await page.screenshot({ path: out('dashboard'), fullPage: true });

await page.goto(`${base}${ORG}/pipeline`);
await page.screenshot({ path: out('pipeline') });

await page.goto(`${base}${ORG}/contacts`);
await page.getByRole('link', { name: 'dr. Maya Putri' }).click();
await page.getByRole('button', { name: 'Summarize' }).click();
await page.getByText(/^- dr\. Maya Putri/).waitFor();
await page.getByRole('button', { name: 'Draft', exact: true }).click();
await page.getByRole('textbox', { name: 'Draft message' }).waitFor();
await page.screenshot({ path: out('contact-ai'), fullPage: true });

await page.goto(`${base}${ORG}/contacts`);
await page.screenshot({ path: out('contacts') });

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await page.context().storageState() });
await phone.goto(`${base}${ORG}`);
await phone.screenshot({ path: out('mobile-dashboard') });

await browser.close();
