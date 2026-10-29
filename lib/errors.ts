/** Turns PostgREST/Postgres errors into messages a user can act on. */

type DbError = { code?: string; message?: string; hint?: string | null; details?: string | null };

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function friendlyDbError(error: DbError): string {
  switch (error.code) {
    case '23505':
      if (error.message?.includes('contacts_org_email')) return 'A contact with this email already exists.';
      if (error.message?.includes('companies_org_name')) return 'A company with this name already exists.';
      if (error.message?.includes('invitations_open_email')) return 'This email already has an open invitation.';
      return error.message === 'already a member' ? 'This person is already a member.' : 'That already exists.';
    case '23503':
      return error.message?.includes('pipeline_stages')
        ? 'Move the deals out of this stage before deleting it.'
        : 'A linked record no longer exists. Refresh and try again.';
    case '23514':
      return error.message?.includes('owner must be a member')
        ? 'The owner must be a member of this workspace.'
        : 'Some values are out of range. Check the form and try again.';
    case '42501':
      // RLS rejections carry a generic message; RPC guards carry a specific one.
      return error.message && !error.message.startsWith('new row violates') && !error.message.startsWith('permission denied')
        ? capitalize(error.message)
        : 'You do not have permission to do that.';
    case 'P0001':
    case 'P0002':
    case '22023':
      return capitalize(error.message ?? 'Something went wrong.');
    default:
      return 'Something went wrong. Please try again.';
  }
}

function capitalize(message: string): string {
  const text = message.endsWith('.') ? message : `${message}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
