import { CATEGORIES, interestsByCategory, type Category } from '@/lib/interests';
import { AGE_RANGES, ORIGINS, TIMES_IN_CITY, validateProfile, type Profile, type ProfileInput } from '@/lib/profile';
import { validateReview, type Review } from '@/lib/review';

// Pure generators for the fake study data (scripts/seed.ts). Same seed → same profiles,
// pairs and answers; dates are set by the script relative to "now".

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const chance = (rng: () => number, p: number) => rng() < p;

// Taste "tribes": similar profiles inside a tribe, opposite ones across tribes.
const TRIBES: string[][] = [
  ['music_electronic', 'music_pop', 'music_latin', 'sports_gym', 'food_street', 'food_burgers', 'hob_clubbing', 'hob_festivals', 'hob_bars'],
  ['music_indie', 'music_rock', 'sports_climbing', 'sports_running', 'sports_cycling', 'food_veggie', 'food_brunch', 'hob_hiking', 'hob_photo', 'hob_travel'],
  ['music_fado', 'music_jazz', 'music_classical', 'sports_yoga', 'food_portuguese', 'food_wine', 'hob_art', 'hob_reading', 'hob_terraces'],
  ['music_mpb', 'music_sertanejo', 'music_funk', 'sports_football', 'sports_volleyball', 'food_brazilian', 'food_japanese', 'hob_dinners', 'hob_dance', 'hob_beach'],
  ['music_metal', 'music_kpop', 'music_hiphop', 'sports_martial', 'sports_basketball', 'food_mexican', 'food_craftbeer', 'hob_games', 'hob_movies', 'hob_instruments'],
  ['music_pop', 'music_indie', 'sports_surf', 'sports_swimming', 'sports_padel', 'food_italian', 'food_indian', 'hob_beach', 'hob_languages', 'hob_volunteer', 'hob_cooking', 'hob_knitting'],
];

const NAMES = [
  'Ana', 'Beatriz', 'Carolina', 'Daniela', 'Inês', 'Joana', 'Mariana', 'Rita', 'Sofia', 'Marta', 'Luana', 'Camila',
  'Larissa', 'Emma', 'Chloe', 'Lena', 'João', 'Pedro', 'Tiago', 'Miguel', 'Rui', 'Diogo', 'André', 'Bruno',
  'Gabriel', 'Lucas', 'Rafael', 'Matheus', 'Thiago', 'Leo', 'Sam', 'Noah', 'Alex', 'Max', 'Nuno', 'Hugo',
]; // seed names: first names only
const CITIES = ['Lisbon', 'Lisbon', 'Lisbon', 'Porto', 'Porto', 'Coimbra', 'Braga'];
const TOPICS = {
  en: ['Best brunch spots in town', 'Hidden beaches near the city', 'A good book you read lately', 'Learning to surf as an adult', 'Live music this month', 'Weekend hiking trails'],
  pt: ['Os melhores sítios para brunch', 'Praias escondidas perto da cidade', 'Um bom livro que leste', 'Aprender a surfar em adulto', 'Concertos este mês', 'Trilhos para o fim de semana'],
};
const OTHERS: Partial<Record<Category, string[]>> = {
  music: ['Synthwave', 'Bossa nova', 'Afrobeat'],
  hobbies: ['Board games', 'Jardinagem', 'Cerâmica'],
};

export type SeedPerson = Profile & { key: string };

function interestsFor(rng: () => number, tribe: string[]): string[] {
  return CATEGORIES.flatMap((category) => {
    const all = interestsByCategory(category).map((i) => i.code);
    const preferred = all.filter((c) => tribe.includes(c));
    const want = 3 + Math.floor(rng() * 4); // 3–6 per category
    const chosen = new Set<string>();
    while (chosen.size < want) chosen.add(chance(rng, 0.75) && preferred.length ? pick(rng, preferred) : pick(rng, all));
    return [...chosen];
  });
}

// `n` valid fake profiles (checked with the same validation as sign-up).
export function seedPeople(n: number, rng: () => number): SeedPerson[] {
  return Array.from({ length: n }, (_, i) => {
    const lang = chance(rng, 0.55) ? 'pt' : 'en';
    const name = pick(rng, NAMES);
    const interests = interestsFor(rng, TRIBES[i % TRIBES.length]);
    const byCode = chance(rng, 0.5);
    const other: Record<string, string> = {};
    for (const [category, texts] of Object.entries(OTHERS)) if (chance(rng, 0.12)) other[category] = pick(rng, texts!);
    const key = `seed.${name.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}${String(i + 1).padStart(3, '0')}`;
    const input: ProfileInput = {
      name,
      whatsapp: `+351900${String(100000 + i)}`,
      instagram: key,
      city: pick(rng, CITIES),
      lang,
      age_range: pick(rng, AGE_RANGES),
      time_in_city: pick(rng, TIMES_IN_CITY),
      origin: pick(rng, ORIGINS),
      interests,
      other_text: other,
      talk_about: byCode ? '' : pick(rng, TOPICS[lang]),
      talk_about_code: byCode ? pick(rng, interests) : '',
      consent: true,
    };
    const result = validateProfile(input);
    if (!result.ok) throw new Error(`invalid seed profile ${i}: ${JSON.stringify(result.errors)}`);
    return { ...result.data, key };
  });
}

function score(rng: () => number, mean: number): number {
  // Sum of uniforms ≈ normal; spread ~1.2 points.
  const noise = (rng() + rng() + rng() - 1.5) * 1.6;
  return Math.max(1, Math.min(7, Math.round(mean + noise)));
}

// One review answer. Compatible matches and more shared items do slightly better.
export function seedReview(rng: () => number, type: 'compatible' | 'control', sharedCount: number): Review {
  const bonus = (type === 'compatible' ? 0.7 : 0) + 0.08 * Math.min(sharedCount, 8);
  const contacted = chance(rng, 0.45 + (type === 'compatible' ? 0.15 : 0) + 0.02 * Math.min(sharedCount, 8));
  const talked = contacted && chance(rng, 0.55 + (type === 'compatible' ? 0.15 : 0));
  const input = {
    contacted,
    interest_1_7: score(rng, 4 + bonus),
    who_first: contacted ? pick(rng, ['me', 'them'] as const) : undefined,
    comfort_1_7: contacted ? score(rng, 4.3 + bonus / 2) : undefined,
    why_not: contacted ? undefined : pick(rng, ['no_time', 'no_time', 'not_interested', 'no_reply', 'no_reply', 'shy', 'other'] as const),
    talked: contacted ? talked : undefined,
    flow_1_7: talked ? score(rng, 4.2 + bonus) : undefined,
    common_ground_1_7: talked ? score(rng, 3.8 + bonus * 1.2) : undefined,
    satisfaction_1_7: talked ? score(rng, 4.1 + bonus) : undefined,
    meet_again_1_7: talked ? score(rng, 3.9 + bonus) : undefined,
    met: talked ? pick(rng, ['yes', 'planned', 'no', 'no'] as const) : undefined,
    comment: chance(rng, 0.15) ? pick(rng, ['Foi giro!', 'Nice chat', 'Combinámos um café', 'Not much in common']) : '',
  };
  const result = validateReview(input);
  if (!result.ok) throw new Error(`invalid seed review: ${JSON.stringify(result.errors)}`);
  return result.data;
}
