import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/en';
import pt from '@/lib/i18n/pt';
import { whatsappLink, whatsappMessage } from '@/lib/icebreaker';

describe('whatsappMessage', () => {
  it('leads with their chosen topic, then up to 3 shared interests', () => {
    expect(
      whatsappMessage({
        t: en.match,
        me: 'Marta',
        them: 'Steven',
        topic: { text: 'Climbing spots around Porto' },
        shared: ['Rock', 'Climbing', 'Surf', 'Japanese'],
      }),
    ).toBe(
      'Hi Steven! Marta here, we matched on BLOP Match 👋 I saw you want to talk about “Climbing spots around Porto”. Tell me more! We also have Rock, Climbing and Surf in common.',
    );
  });

  it('uses the interest label when the topic is one of their interests (PT)', () => {
    expect(
      whatsappMessage({ t: pt.match, me: 'Marta', them: 'Inês', topic: { label: 'Tricô' }, shared: ['Fado'] }),
    ).toBe('Olá Inês! Marta aqui, fizemos match no BLOP Match 👋 Vi que queres falar sobre Tricô. Conta-me mais! Também temos em comum Fado.');
  });

  it('falls back to shared interests, then to a generic invite', () => {
    expect(whatsappMessage({ t: en.match, me: 'A', them: 'B', topic: null, shared: ['Rock', 'Surf'] })).toBe(
      'Hi B! A here, we matched on BLOP Match 👋 We have Rock and Surf in common. Fancy a chat?',
    );
    expect(whatsappMessage({ t: pt.match, me: 'A', them: 'B', topic: null, shared: [] })).toBe(
      'Olá B! A aqui, fizemos match no BLOP Match 👋 Vamos conversar?',
    );
  });
});

describe('whatsappLink', () => {
  it('keeps only digits in the number and encodes the message', () => {
    expect(whatsappLink('+351 912 345 678', 'Olá & até já?')).toBe(
      'https://wa.me/351912345678?text=Ol%C3%A1%20%26%20at%C3%A9%20j%C3%A1%3F',
    );
  });
});
