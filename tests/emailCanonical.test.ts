import { describe, expect, it } from 'vitest';
import { canonicalEmail } from '@/lib/emailCanonical';

describe('canonicalEmail', () => {
  it('drops +tags, Gmail dots and case', () => {
    expect(canonicalEmail(' Ana.Silva+blop@Gmail.com ')).toBe('anasilva@gmail.com');
    expect(canonicalEmail('a.n.a@googlemail.com')).toBe('ana@gmail.com');
    expect(canonicalEmail('ana+1@outlook.com')).toBe('ana@outlook.com');
  });

  it('keeps dots outside Gmail and leaves test accounts alone', () => {
    expect(canonicalEmail('ana.silva@outlook.com')).toBe('ana.silva@outlook.com');
    expect(canonicalEmail('blopmatch+e2e03@gmail.com')).toBe('blopmatch+e2e03@gmail.com');
  });
});
