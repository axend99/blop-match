import { describe, expect, it } from 'vitest';
import { signSession, tokenMatches, tokenUsable, verifySession } from '@/lib/adminSession';
import { toCsv } from '@/lib/csv';

const TOKEN = 'x'.repeat(40);
const NOW = 1_800_000_000_000;

describe('admin access link', () => {
  it('needs a configured token of at least 32 characters', () => {
    expect(tokenUsable(undefined)).toBe(false);
    expect(tokenUsable('')).toBe(false);
    expect(tokenUsable('short')).toBe(false);
    expect(tokenUsable(TOKEN)).toBe(true);
  });

  it('compares the token in constant time, whatever the input length', () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(tokenMatches('nope', TOKEN)).toBe(false);
    expect(tokenMatches('', undefined)).toBe(false);
    expect(tokenMatches('', '')).toBe(false);
  });

  it('accepts its own signed cookie until it expires', () => {
    const cookie = signSession(TOKEN, NOW);
    expect(verifySession(cookie, TOKEN, NOW + 1000)).toBe(true);
    expect(verifySession(cookie, TOKEN, NOW + 31 * 86_400_000)).toBe(false);
  });

  it('rejects tampered, malformed or foreign cookies, and any cookie without a usable token', () => {
    const cookie = signSession(TOKEN, NOW);
    const [exp, sig] = cookie.split('.');
    expect(verifySession(`${Number(exp) + 1}.${sig}`, TOKEN, NOW)).toBe(false);
    expect(verifySession(`${exp}.${'0'.repeat(64)}`, TOKEN, NOW)).toBe(false);
    expect(verifySession('garbage', TOKEN, NOW)).toBe(false);
    expect(verifySession(`${exp}.${sig}x`, TOKEN, NOW)).toBe(false);
    expect(verifySession(cookie, 'y'.repeat(40), NOW)).toBe(false); // rotated token
    expect(verifySession(signSession('', NOW), '', NOW)).toBe(false); // empty token never works
    expect(verifySession(cookie, undefined, NOW)).toBe(false);
  });
});

describe('toCsv', () => {
  it('quotes commas, quotes and newlines and starts with a BOM', () => {
    const csv = toCsv(['a', 'b'], [{ a: 'x, y', b: 'say "hi"\nok' }]);
    expect(csv).toBe('﻿a,b\r\n"x, y","say ""hi""\nok"\r\n');
  });

  it('neutralises formula-like strings but keeps numbers', () => {
    const csv = toCsv(['t', 'n', 'arr'], [{ t: '=HYPERLINK("x")', n: -0.5, arr: ['@a', 'b'] }]);
    expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",-0.5,'@a; b`);
    expect(toCsv(['t'], [{ t: '\tcmd' }]).split('\r\n')[1]).toBe("'\tcmd");
    expect(toCsv(['t'], [{ t: ' =1+1' }]).split('\r\n')[1]).toBe("' =1+1");
  });

  it('writes empty cells for null and JSON for objects', () => {
    expect(toCsv(['a', 'o'], [{ a: null, o: { music: 1 } }]).split('\r\n')[1]).toBe(',"{""music"":1}"');
  });
});
