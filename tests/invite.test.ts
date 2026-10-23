import { describe, expect, it } from 'vitest';
import { parseEmailList, pendingInvites } from '@/lib/invite';

describe('parseEmailList', () => {
  it('splits on lines, commas, semicolons and spaces, lower-cases and drops repeats', () => {
    expect(parseEmailList('A@x.com\nb@y.pt, c@z.com; a@x.com  <D@w.com>\n\n')).toEqual({
      valid: ['a@x.com', 'b@y.pt', 'c@z.com', 'd@w.com'],
      invalid: [],
    });
  });

  it('reports what is not an address', () => {
    expect(parseEmailList('ok@x.com nope @x.com a@b')).toEqual({ valid: ['ok@x.com'], invalid: ['nope', '@x.com', 'a@b'] });
  });

  it('handles an empty list', () => {
    expect(parseEmailList('  \n ')).toEqual({ valid: [], invalid: [] });
  });
});

describe('pendingInvites', () => {
  it('skips people already invited, banned or already participating (same mailbox)', () => {
    const result = pendingInvites(['new@x.com', 'old@x.com', 'bad@x.com', 'ana.silva@gmail.com'], {
      invited: new Set(['old@x.com']),
      banned: new Set(['bad@x.com']),
      participants: new Set(['anasilva@gmail.com']),
    });
    expect(result).toEqual({ toSend: ['new@x.com'], skipped: { invited: 1, banned: 1, participant: 1 } });
  });

  it('compares by mailbox: one e-mail per inbox, and variants of invited or banned addresses are skipped', () => {
    const result = pendingInvites(['a.b@gmail.com', 'ab+x@gmail.com', 'old.one@gmail.com', 'bad+2@x.com'], {
      invited: new Set(['oldone@gmail.com']),
      banned: new Set(['bad@x.com']),
      participants: new Set(),
    });
    expect(result).toEqual({ toSend: ['a.b@gmail.com'], skipped: { invited: 1, banned: 1, participant: 0 } });
  });
});
