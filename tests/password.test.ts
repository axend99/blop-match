import { describe, expect, it } from 'vitest';
import { cleanGuess, guessCounts, guessIsRight, validatePassword } from '@/lib/password';

describe('validatePassword', () => {
  it('accepts one word of 2 to 20 letters, trimmed, any alphabet', () => {
    expect(validatePassword('  girassol ')).toEqual({ ok: true, value: 'girassol' });
    expect(validatePassword('Coração')).toEqual({ ok: true, value: 'Coração' });
    expect(validatePassword('мост')).toEqual({ ok: true, value: 'мост' });
    expect(validatePassword('ab')).toEqual({ ok: true, value: 'ab' });
  });

  it('rejects empty, too short or long, several words, digits and symbols', () => {
    for (const bad of ['', ' ', 'a', 'a'.repeat(21), 'two words', 'pass1', 'hi!', 'semi-colon', null, 42]) {
      expect(validatePassword(bad).ok).toBe(false);
    }
  });
});

describe('cleanGuess', () => {
  it('is null when empty and collapses spaces otherwise', () => {
    expect(cleanGuess('   ')).toBe(null);
    expect(cleanGuess(undefined)).toBe(null);
    expect(cleanGuess('  sun   flower ')).toBe('sun flower');
    expect(cleanGuess('x'.repeat(60))).toHaveLength(40);
  });
});

describe('guessIsRight', () => {
  it('ignores case, accents and punctuation', () => {
    expect(guessIsRight('Coracao!', 'coração')).toBe(true);
    expect(guessIsRight(' GIRASSOL ', 'girassol')).toBe(true);
  });

  it('is false for a different word, a missing guess or a missing password', () => {
    expect(guessIsRight('girafa', 'girassol')).toBe(false);
    expect(guessIsRight(null, 'girassol')).toBe(false);
    expect(guessIsRight('girassol', null)).toBe(false);
    expect(guessIsRight('!!!', '!!!')).toBe(false);
  });
});

describe('guessCounts', () => {
  it('trusts the stored verdict and falls back to the plain comparison', () => {
    expect(guessCounts(true, 'coração', 'heart')).toBe(true);
    expect(guessCounts(false, 'Heart', 'heart')).toBe(false);
    expect(guessCounts(null, 'Heart', 'heart')).toBe(true);
    expect(guessCounts(undefined, 'coração', 'heart')).toBe(false);
    expect(guessCounts(true, null, 'heart')).toBe(false);
  });
});
