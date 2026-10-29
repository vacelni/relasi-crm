import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'correct-horse-42';

async function signUp(page: Page, name: string, email: string) {
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
}

test('a new team: sign up, create a workspace, add and import contacts, invite a teammate', async ({ page, browser }) => {
  const stamp = Date.now();
  const ownerEmail = `owner-${stamp}@example.com`;
  const teammateEmail = `sales-${stamp}@example.com`;

  await page.goto('/signup');
  await signUp(page, 'Putri Owner', ownerEmail);
  await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible();
  await page.getByLabel('Business or team name').fill(`Toko Test ${stamp}`);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: `Toko Test ${stamp}` })).toBeVisible();
  const orgUrl = new URL(page.url()).pathname;

  // A contact, then an interaction on it.
  await page.getByRole('link', { name: 'Contacts', exact: true }).click();
  await page.getByText('+ New contact').click();
  await page.getByLabel('Name').fill('Rahmat Hidayat');
  await page.getByLabel('Email').fill('Rahmat@Example.com');
  await page.getByLabel('Phone / WhatsApp').fill('0812-9999-0000');
  await page.getByRole('button', { name: 'Add contact' }).click();
  await expect(page.getByRole('heading', { name: 'Rahmat Hidayat' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'rahmat@example.com' })).toBeVisible();

  await page.getByLabel('Subject').fill('Intro call');
  await page.getByLabel('What happened').fill('Needs a catalogue site before Lebaran. Budget approved.');
  await page.getByRole('button', { name: 'Log it' }).click();
  await expect(page.getByText('Logged.')).toBeVisible();
  await expect(page.getByText('Needs a catalogue site before Lebaran. Budget approved.')).toBeVisible();

  // CSV import: two valid rows, one without email, one without a name.
  await page.getByRole('link', { name: 'Import', exact: true }).click();
  await page.getByLabel('CSV file').setInputFiles(path.join(__dirname, 'fixtures', 'contacts.csv'));
  await expect(page.getByText('3 ready to import')).toBeVisible();
  await expect(page.getByText('Line 5: missing name')).toBeVisible();
  await page.getByRole('button', { name: 'Import 3 contacts' }).click();
  await expect(page.getByText('Imported 3 contacts.')).toBeVisible();
  await page.getByRole('link', { name: 'View contacts' }).click();
  await expect(page.getByText('4 contacts')).toBeVisible();

  // Invite a sales teammate and accept in a separate browser session.
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Email').fill(teammateEmail);
  await page.getByRole('button', { name: 'Create invite' }).click();
  await expect(page.getByText(`Copy the link below and send it to ${teammateEmail}.`)).toBeVisible();
  await expect(page.getByText('2 of 3 seats used (including open invitations)')).toBeVisible();

  const inviteHref = await page.evaluate(async () => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copy invite link')!;
    let copied = '';
    navigator.clipboard.writeText = async (text: string) => {
      copied = text;
    };
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return copied;
  });
  expect(inviteHref).toMatch(/\/invite\/[0-9a-f-]{36}$/);

  const teammate = await browser.newPage();
  await teammate.goto(inviteHref);
  await expect(teammate).toHaveURL(/\/signup\?next=/);
  await signUp(teammate, 'Sari Sales', teammateEmail);
  await expect(teammate.getByRole('heading', { name: "You've been invited" })).toBeVisible();
  await teammate.getByRole('button', { name: 'Join workspace' }).click();
  await expect(teammate.getByRole('heading', { name: `Toko Test ${stamp}` })).toBeVisible();
  expect(new URL(teammate.url()).pathname).toBe(orgUrl);

  // Tenant isolation: the new team cannot open the demo workspace.
  const response = await teammate.goto('/o/de000000-0000-4000-8000-000000000001');
  expect(response?.status()).toBe(404);
  await teammate.close();
});

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/o/de000000-0000-4000-8000-000000000001/contacts');
  await expect(page).toHaveURL(/\/login\?next=%2Fo%2Fde000000/);
});
