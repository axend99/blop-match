import { describe, expect, it } from 'vitest';
import { countryList, formatNational, splitInternational, toWhatsapp } from '@/lib/phone';

describe('phone', () => {
  it('validates national numbers for the chosen country', () => {
    expect(toWhatsapp('912 345 678', 'PT')).toBe('+351912345678');
    expect(toWhatsapp('(11) 98765-4321', 'BR')).toBe('+5511987654321');
    expect(toWhatsapp('212 345 678', 'PT')).toBeNull();
    expect(toWhatsapp('912 345 678')).toBeNull();
  });

  it('takes the country from international numbers', () => {
    expect(toWhatsapp('+55 11 98765 4321', 'PT')).toBe('+5511987654321');
    expect(splitInternational('+55 11 98765-4321')).toEqual({ country: 'BR', national: '11987654321' });
    expect(splitInternational('00351 912 345 678')).toEqual({ country: 'PT', national: '912345678' });
    expect(splitInternational('912')).toBeUndefined();
  });

  it('formats while typing and lists Portugal and Brazil first', () => {
    expect(formatNational('912345678', 'PT')).toBe('912 345 678');
    const list = countryList('pt');
    expect(list.slice(0, 2).map((c) => c.code)).toEqual(['PT', 'BR']);
    expect(list[0].label).toContain('+351');
  });
});
