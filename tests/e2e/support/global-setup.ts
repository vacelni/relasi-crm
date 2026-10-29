import { execSync } from 'node:child_process';

/** Calls reset_demo() on the local Supabase (service role from `supabase status`). */
export default async function globalSetup() {
  const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as {
    API_URL: string;
    SECRET_KEY?: string;
    SERVICE_ROLE_KEY: string;
  };
  const key = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  const response = await fetch(`${status.API_URL}/rest/v1/rpc/reset_demo`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`reset_demo failed: ${response.status} ${await response.text()}`);
}
