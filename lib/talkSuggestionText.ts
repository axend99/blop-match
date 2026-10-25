import { MAX_TALK_ABOUT } from '@/lib/profile';

// Checks the AI's "what I want to talk about" line before showing it (pure, tested).
export const MAX_SUGGESTION = 90; // what the AI is asked for; up to the field's limit is accepted

// Notes about the task itself ("(87 characters)", "Here is the line: …", "Frase: …") mean the
// reply is not a clean line: rejected rather than shown. Ordinary words like "count" or
// "characters" inside a real sentence are fine.
const META =
  /\d+\s*(characters?|chars?|caracteres)(?=\W|$)|^(here is|here's|aqui (está|tens))(?=\W|$)|^(sentence|line|frase)\s*:/iu;

export function cleanSuggestion(raw: string): string | null {
  const text = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“'«]+|["”'»]+$/g, '')
    .trim();
  if (!text || text.length > MAX_TALK_ABOUT || META.test(text)) return null;
  return text;
}
