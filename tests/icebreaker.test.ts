import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/en';
import pt from '@/lib/i18n/pt';
import { whatsappLink, whatsappMessage } from '@/lib/icebreaker';

const l = (code: string, label: string) => ({ code, label });

describe('whatsappMessage', () => {
  it('leads with their own words, then up to 3 shared interests', () => {
    expect(
      whatsappMessage({
        t: en.match,
        me: 'Marta',
        them: 'Steven',
        topic: { text: 'Climbing spots around Porto?' },
        shared: [l('a', 'Rock'), l('b', 'Climbing'), l('c', 'Surf'), l('d', 'Japanese')],
      }),
    ).toBe(
      'Hi Steven! Marta here, BLOP Match put us together 👋 I saw what you\'d like to talk about: “Climbing spots around Porto?” Tell me more! We also have in common: Rock, Climbing, Surf.',
    );
  });

  it('does not repeat the chosen interest in the shared list (PT)', () => {
    expect(
      whatsappMessage({
        t: pt.match,
        me: 'Marta',
        them: 'Inês',
        topic: l('hob_knitting', 'Tricô'),
        shared: [l('hob_knitting', 'Tricô'), l('music_fado', 'Fado'), l('sports_yoga', 'Yoga e Pilates')],
      }),
    ).toBe(
      'Olá Inês! Marta aqui, o BLOP Match juntou-nos 👋 Vi que queres falar sobre Tricô. Conta-me mais! Também temos em comum: Fado, Yoga e Pilates.',
    );
  });

  it('works with a topic and nothing else in common', () => {
    expect(whatsappMessage({ t: en.match, me: 'A', them: 'B', topic: l('x', 'Surf'), shared: [l('x', 'Surf')] })).toBe(
      "Hi B! A here, BLOP Match put us together 👋 I saw you'd like to talk about Surf. Tell me more!",
    );
  });

  it('falls back to shared interests, then to a generic invite', () => {
    expect(whatsappMessage({ t: en.match, me: 'A', them: 'B', topic: null, shared: [l('r', 'Rock'), l('s', 'Surf')] })).toBe(
      'Hi B! A here, BLOP Match put us together 👋 We have in common: Rock, Surf. Fancy a chat?',
    );
    expect(whatsappMessage({ t: pt.match, me: 'A', them: 'B', topic: null, shared: [] })).toBe(
      'Olá B! A aqui, o BLOP Match juntou-nos 👋 Vamos conversar?',
    );
  });
});

describe('whatsappLink', () => {
  it('keeps only digits in the number and encodes the whole message (accents, emoji, quotes)', () => {
    const message = whatsappMessage({ t: pt.match, me: 'Zé', them: 'Inês', topic: { text: 'Fado & vinho?' }, shared: [] });
    const link = whatsappLink('+351 912 345 678', message);
    expect(link.startsWith('https://wa.me/351912345678?text=')).toBe(true);
    expect(decodeURIComponent(link.split('?text=')[1])).toBe(message);
    expect(link).not.toMatch(/[\s“”👋&]/u);
  });
});
