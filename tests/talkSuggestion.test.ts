import { describe, expect, it } from 'vitest';
import { MAX_TALK_ABOUT } from '@/lib/profile';
import { cleanSuggestion } from '@/lib/talkSuggestionText';

describe('cleanSuggestion', () => {
  it('keeps a short line, without wrapping quotes or extra spaces', () => {
    expect(cleanSuggestion('  “Que série de terror me recomendas?  ”')).toBe('Que série de terror me recomendas?');
  });

  it('keeps real sentences that happen to use words like count or characters', () => {
    for (const s of ['Count me in for padel in Porto!', 'Favourite anime characters?', 'Que frase de filme sabes de cor?']) {
      expect(cleanSuggestion(s)).toBe(s);
    }
  });

  it('rejects notes about the task, empty and too-long replies', () => {
    for (const s of [
      'Adoro thrillers! Count: about 115 characters. Fine',
      'Qual o melhor fado? (87 caracteres)',
      'Aqui está a frase: qual o melhor fado?',
      'Frase: qual o melhor fado?',
      "Here's the line: best ramen in Porto?",
      '   ',
      'a'.repeat(MAX_TALK_ABOUT + 1),
    ]) {
      expect(cleanSuggestion(s)).toBeNull();
    }
  });
});
