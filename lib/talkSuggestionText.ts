// Checks the AI's "what I want to talk about" sentence before showing it (pure, tested).
export const MAX_SUGGESTION = 90;

// Notes about the task itself ("Count: 115 characters", "Here is…") mean the reply is not a
// clean sentence: rejected rather than shown.
const META = /\b(count|characters?|caracteres|sentence|frase:|here is|aqui está)\b/i;

export function cleanSuggestion(raw: string): string | null {
  const text = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“'«]+|["”'»]+$/g, '')
    .trim();
  if (!text || text.length > MAX_SUGGESTION || META.test(text)) return null;
  return text;
}
