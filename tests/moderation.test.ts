import { describe, expect, it } from 'vitest';
import { errorFlags, flagsFrom, moderationOutcome, profileTexts, resultSchema, reviewTexts } from '@/lib/moderation';

describe('moderation inputs', () => {
  it('collects the first name and only non-empty free text from the profile', () => {
    expect(profileTexts({ name: 'Ana', talk_about: 'surf', other_text: { music: 'synthwave', food: '' } })).toEqual([
      { field: 'name', text: 'Ana' },
      { field: 'talk_about', text: 'surf' },
      { field: 'other_text.music', text: 'synthwave' },
    ]);
    expect(profileTexts({ name: 'Ana', talk_about: null, other_text: {} })).toEqual([{ field: 'name', text: 'Ana' }]);
  });

  it('collects the review comment when present', () => {
    expect(reviewTexts({ comment: 'nice' })).toEqual([{ field: 'review_comment', text: 'nice' }]);
    expect(reviewTexts({ comment: null })).toEqual([]);
  });

  it('limits the answer schema to the fields that were sent', () => {
    const schema = resultSchema(['talk_about']);
    expect(schema.properties.results.items.properties.field.enum).toEqual(['talk_about']);
  });
});

describe('flagsFrom', () => {
  const texts = [
    { field: 'talk_about', text: 'a' },
    { field: 'other_text.music', text: 'b' },
    { field: 'review_comment', text: 'c' },
  ];

  it('keeps flagged texts, drops clean ones and marks missing ones as errors', () => {
    const rows = flagsFrom(texts, [
      { field: 'talk_about', flagged: true, category: 'sexual', reason: 'Conteúdo sexual explícito.' },
      { field: 'other_text.music', flagged: false, category: 'none', reason: '' },
      { field: 'unknown', flagged: true, category: 'spam', reason: 'x' },
    ]);
    expect(rows).toEqual([
      { field: 'talk_about', text: 'a', status: 'flagged', category: 'sexual', reason: 'Conteúdo sexual explícito.' },
      { field: 'review_comment', text: 'c', status: 'error', category: null, reason: expect.any(String) },
    ]);
  });

  it('marks every text as not verified on failure', () => {
    expect(errorFlags(texts.slice(0, 1), 'falhou')).toEqual([
      { field: 'talk_about', text: 'a', status: 'error', category: null, reason: 'falhou' },
    ]);
  });
});

describe('moderationOutcome', () => {
  const row = (status: 'flagged' | 'error') => ({ field: 'name', text: 'x', status, category: null, reason: '' });
  it('is clean without alerts, flagged if anything is flagged, error otherwise', () => {
    expect(moderationOutcome([])).toBe('clean');
    expect(moderationOutcome([row('error')])).toBe('error');
    expect(moderationOutcome([row('error'), row('flagged')])).toBe('flagged');
  });
});
