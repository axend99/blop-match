import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/next';

describe('safeNext', () => {
  it('only allows paths inside /me/', () => {
    expect(safeNext('/me/report/2f1c0a4e-1111-4222-8333-944445555666')).toBe('/me/report/2f1c0a4e-1111-4222-8333-944445555666');
    expect(safeNext('/admin')).toBeNull();
    expect(safeNext('https://evil.com/me/')).toBeNull();
    expect(safeNext('//evil.com/me/')).toBeNull();
    expect(safeNext('/me//evil.com')).toBeNull();
    expect(safeNext('/me/\\evil')).toBeNull();
    expect(safeNext('/me/x?y=1')).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
