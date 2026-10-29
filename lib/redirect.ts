/**
 * Post-login/sign-up redirect targets. Only a path on this site is accepted: the value is
 * resolved against a dummy origin (browsers drop tabs and newlines, so "/\t/evil.example" would
 * otherwise become "//evil.example") and anything that lands elsewhere falls back.
 */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const base = 'http://relasi.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    // Check the normalized result too: "/.//evil.example" resolves to the path "//evil.example".
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path.startsWith('//') || path.startsWith('/\\')) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
