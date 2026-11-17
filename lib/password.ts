// The v2 password game: each participant chooses one secret word and tries to say it as often as
// possible in conversation without the match noticing; in the review each one guesses the
// other's word. Pure functions (tested in tests/password.test.ts).

export const PASSWORD_MIN = 2;
export const PASSWORD_MAX = 20;
export const GUESS_MAX = 40;

// One word: letters only (any alphabet, accents included), 2 to 20 of them.
const WORD_RE = new RegExp(`^\\p{L}{${PASSWORD_MIN},${PASSWORD_MAX}}$`, 'u');

export function validatePassword(input: unknown): { ok: true; value: string } | { ok: false } {
  const value = typeof input === 'string' ? input.trim() : '';
  return WORD_RE.test(value) ? { ok: true, value } : { ok: false };
}

// The guess typed in the review: optional, trimmed, inner spaces collapsed; empty means "no idea".
export function cleanGuess(input: unknown): string | null {
  const value = typeof input === 'string' ? input.replace(/\s+/g, ' ').trim() : '';
  return value ? value.slice(0, GUESS_MAX) : null;
}

// Case, accents and surrounding punctuation do not matter: "Girassol!" matches "girassol".
function fold(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function guessIsRight(guess: string | null, password: string | null): boolean {
  if (!guess || !password) return false;
  return fold(guess) !== '' && fold(guess) === fold(password);
}
