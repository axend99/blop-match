import { describe, expect, it } from 'vitest';
import { cleanSuggestion, MAX_SUGGESTION } from '@/lib/talkSuggestionText';

describe('cleanSuggestion', () => {
  it('keeps a short sentence, without wrapping quotes or extra spaces', () => {
    expect(cleanSuggestion('  “Que série de terror me recomendas?  ”')).toBe('Que série de terror me recomendas?');
  });

  it('rejects notes about the task, empty and too-long replies', () => {
    expect(cleanSuggestion('Adoro thrillers do Porto! Count: about 115 characters. Fine')).toBeNull();
    expect(cleanSuggestion('   ')).toBeNull();
    expect(cleanSuggestion('a'.repeat(MAX_SUGGESTION + 1))).toBeNull();
  });
});
