import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it('keeps same-site paths with their query', () => {
    expect(safeRedirectPath('/o/abc/contacts?q=dewi', '/o')).toBe('/o/abc/contacts?q=dewi');
    expect(safeRedirectPath('/invite/123', '/o')).toBe('/invite/123');
  });

  it('rejects anything that could leave the site', () => {
    for (const value of [
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/.//evil.example',
      '/a/..//evil.example',
      '/%2e//evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      'evil.example',
      '',
      null,
    ]) {
      expect(safeRedirectPath(value, '/o')).toBe('/o');
    }
  });
});
