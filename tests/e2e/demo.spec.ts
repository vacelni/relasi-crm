import { expect, test, type Locator, type Page } from '@playwright/test';

const ORG = '/o/de000000-0000-4000-8000-000000000001';

async function signInDemo(page: Page, role: 'owner' | 'sales') {
  await page.goto('/login');
  await page.getByRole('button', { name: `Demo as ${role}` }).click();
  await expect(page).toHaveURL(new RegExp(`${ORG}$`));
}

/** Drags with real pointer events (dnd-kit's PointerSensor needs a few moves past its 6px threshold). */
async function drag(page: Page, source: Locator, target: Locator) {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 12 });
  await page.mouse.up();
}

function column(page: Page, name: string) {
  return page.getByRole('region', { name: new RegExp(`^${name}:`) });
}

test.describe('demo workspace as owner', () => {
  test.beforeEach(({ page }) => signInDemo(page, 'owner'));

  test('the dashboard shows pipeline numbers and the demo banner', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sinar Digital Agency (demo)' })).toBeVisible();
    await expect(page.getByText('Demo workspace: you are signed in as')).toBeVisible();
    await expect(page.getByText('Open pipeline')).toBeVisible();
    // 3 won and 2 lost in the last 90 days.
    await expect(page.getByText('60%')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pipeline value by stage' })).toBeVisible();
  });

  test('AI summary, lead score, and follow-up draft work without an API key', async ({ page }) => {
    await page.getByRole('link', { name: 'Contacts', exact: true }).click();
    await page.getByRole('link', { name: 'dr. Maya Putri' }).click();
    await expect(page.getByRole('heading', { name: 'dr. Maya Putri' })).toBeVisible();

    await page.getByRole('button', { name: 'Summarize' }).click();
    await expect(page.getByText(/^- dr\. Maya Putri, Clinic director at Klinik Gigi Ceria/)).toBeVisible();
    await expect(page.getByText('Heuristic result: no AI key is configured on this server.')).toBeVisible();

    await page.getByRole('button', { name: 'Score lead' }).click();
    await expect(page.getByText('/ 100')).toBeVisible();
    await expect(page.getByText(/Budget is approved/)).toBeVisible();

    await page.getByRole('button', { name: 'Draft', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Draft message' })).toHaveValue(/^Halo Maya,/);
    await expect(page.getByRole('link', { name: 'Open in WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/6281200001004\?text=/);

    // The score is stored and shown in the contact list.
    await page.getByRole('link', { name: '← Contacts' }).click();
    const row = page.getByRole('row', { name: /dr\. Maya Putri/ });
    await expect(row.getByRole('cell').nth(3)).toHaveText(/^\d+$/);
  });

  test('a deal dragged to another stage stays there', async ({ page }) => {
    await page.goto(`${ORG}/pipeline`);
    const card = page.getByRole('button', { name: /^Referral partnership/ });
    await expect(column(page, 'Lead').getByRole('button', { name: /^Referral partnership/ })).toBeVisible();

    // The board moves the card at once and saves in the background (a server action). Reloading
    // before that save finishes reads the old stage, so wait for its response first.
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && !!r.request().headers()['next-action']);
    await drag(page, card, column(page, 'Qualified'));
    await expect(column(page, 'Qualified').getByRole('button', { name: /^Referral partnership/ })).toBeVisible();
    await saved;

    await page.reload();
    await expect(column(page, 'Qualified').getByRole('button', { name: /^Referral partnership/ })).toBeVisible();
    await expect(column(page, 'Lead').getByRole('button', { name: /^Referral partnership/ })).toHaveCount(0);
  });

  test('extracts contacts from pasted text', async ({ page }) => {
    await page.goto(`${ORG}/contacts`);
    await page.getByText('Paste text to extract contacts').click();
    await page.getByRole('button', { name: 'Use an example' }).click();
    await page.getByRole('button', { name: 'Extract contacts' }).click();
    await expect(page.getByText('Dewi Anggraini', { exact: true })).toBeVisible();
    await expect(page.getByText('Bayu Saputra', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save 2 contacts' }).click();
    await expect(page.getByText('2 saved.')).toBeVisible();
  });
});

test.describe('demo workspace as sales', () => {
  test.beforeEach(({ page }) => signInDemo(page, 'sales'));

  test('teammates’ deals are read-only on the board', async ({ page }) => {
    await page.goto(`${ORG}/pipeline`);
    const theirs = page.getByRole('button', { name: /^Kopi Senja: loyalty app/ });
    await expect(theirs).toHaveAttribute('aria-roledescription', 'deal');
    await drag(page, theirs, column(page, 'Won'));
    await expect(column(page, 'Negotiation').getByRole('button', { name: /^Kopi Senja: loyalty app/ })).toBeVisible();

    const mine = page.getByRole('button', { name: /^Griya Bangun: product catalogue/ });
    await expect(mine).toHaveAttribute('aria-roledescription', 'draggable deal');
  });

  test('cannot see admin-only settings', async ({ page }) => {
    await page.goto(`${ORG}/settings`);
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Invite a teammate' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Audit log' })).toHaveCount(0);

    const response = await page.goto(`${ORG}/settings/audit`);
    expect(response?.status()).toBe(404);
  });

  test('cannot edit a contact owned by the owner', async ({ page }) => {
    await page.goto(`${ORG}/contacts`);
    await page.getByRole('link', { name: 'Dewi Lestari' }).click();
    await expect(page.getByText('Read-only: owned by a teammate.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  });
});
