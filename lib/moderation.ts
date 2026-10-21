import type { Profile } from '@/lib/profile';
import type { Review } from '@/lib/review';

// Free-text moderation (pure parts). The AI never blocks anything: it only records
// alerts for /admin. Only `{ field, text }` pairs are ever sent to it.

export const CATEGORIES = [
  'sexual',
  'obscene',
  'harassment',
  'hate',
  'violence',
  'self_harm',
  'spam',
  'personal_data',
  'none',
] as const;

export type ModerationText = { field: string; text: string };
export type ModerationResult = { field: string; flagged: boolean; category: string; reason: string };
export type FlagRow = { field: string; text: string; status: 'flagged' | 'error'; category: string | null; reason: string };

export function profileTexts(profile: Pick<Profile, 'talk_about' | 'other_text'>): ModerationText[] {
  const texts: ModerationText[] = [];
  if (profile.talk_about) texts.push({ field: 'talk_about', text: profile.talk_about });
  for (const [category, text] of Object.entries(profile.other_text)) {
    if (text) texts.push({ field: `other_text.${category}`, text });
  }
  return texts;
}

export function reviewTexts(review: Pick<Review, 'comment'>): ModerationText[] {
  return review.comment ? [{ field: 'review_comment', text: review.comment }] : [];
}

// JSON schema for the model's answer; `field` is limited to the fields that were sent.
export function resultSchema(fields: string[]) {
  return {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', enum: fields },
            flagged: { type: 'boolean' },
            category: { type: 'string', enum: [...CATEGORIES] },
            reason: { type: 'string' },
          },
          required: ['field', 'flagged', 'category', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  };
}

// Rows to store: flagged texts, plus an error row for any text the model did not assess,
// so nothing silently counts as "clean".
export function flagsFrom(texts: ModerationText[], results: ModerationResult[]): FlagRow[] {
  const byField = new Map(results.map((r) => [r.field, r]));
  return texts.flatMap(({ field, text }): FlagRow[] => {
    const r = byField.get(field);
    if (!r) return [{ field, text, status: 'error', category: null, reason: 'Sem resultado da verificação automática.' }];
    return r.flagged ? [{ field, text, status: 'flagged', category: r.category, reason: r.reason }] : [];
  });
}

// Every text marked as not verified (no key, API error, refusal, invalid answer).
export function errorFlags(texts: ModerationText[], reason: string): FlagRow[] {
  return texts.map(({ field, text }) => ({ field, text, status: 'error', category: null, reason }));
}
