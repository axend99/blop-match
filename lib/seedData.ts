import { CATEGORIES, MAX_PER_CATEGORY, MIN_TOTAL, interestByCode, interestsByCategory, type Category } from '@/lib/interests';
import { ORIGINS, TIMES_IN_CITY, validateProfile, type Profile, type ProfileInput } from '@/lib/profile';
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
  ['music_electronic', 'music_techno', 'music_pop', 'music_latin', 'fit_gym', 'food_street', 'food_burgers', 'food_cocktails', 'act_clubbing', 'act_concerts', 'act_bars', 'movies_action', 'movies_reality'],
  ['music_indie', 'music_rock', 'music_lofi', 'fit_climbing', 'fit_running', 'fit_cycling', 'food_veggie', 'food_brunch', 'act_hiking', 'act_travel', 'hob_photo', 'animals_wildlife', 'movies_docs'],
  ['music_fado', 'music_jazz', 'music_classical', 'fit_yoga', 'food_portuguese', 'food_wine', 'act_museums', 'act_theatre', 'act_terraces', 'hob_reading', 'hob_writing', 'movies_drama', 'animals_cats'],
  ['music_mpb', 'music_samba', 'music_sertanejo', 'music_funk', 'sports_football', 'sports_volleyball', 'food_brazilian', 'food_japanese', 'act_dinners', 'act_beach', 'hob_dancing', 'movies_comedy', 'animals_dogs'],
  ['music_metal', 'music_kpop', 'music_hiphop', 'sports_martial', 'sports_boxing', 'sports_basketball', 'food_mexican', 'food_craftbeer', 'hob_videogames', 'hob_boardgames', 'act_gamenights', 'movies_anime', 'movies_horror', 'movies_scifi'],
  ['music_reggae', 'music_afro', 'music_rnb', 'sports_surf', 'fit_swimming', 'sports_padel', 'food_italian', 'food_indian', 'act_beach', 'act_volunteer', 'hob_languages', 'hob_cooking', 'hob_knitting', 'hob_gardening', 'animals_marine', 'animals_horses', 'movies_romcom'],
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
  hobbies: ['Origami', 'Xadrez', 'Magic tricks'],
};

export type SeedPerson = Profile; // whatsapp is a unique fake number

// 10–20 interests in 3–6 categories (at most 5 per category), weighted towards the tribe.
function interestsFor(rng: () => number, tribe: string[]): string[] {
  const tribeCategories = [...new Set(tribe.map((code) => interestByCode(code)!.category))];
  const extra = CATEGORIES.filter((c) => !tribeCategories.includes(c));
  const categories = [...tribeCategories].sort(() => rng() - 0.5).slice(0, 3 + Math.floor(rng() * 3));
  if (extra.length && chance(rng, 0.4)) categories.push(pick(rng, extra));
  const want = Math.min(MIN_TOTAL + Math.floor(rng() * 11), categories.length * MAX_PER_CATEGORY);
  const chosen = new Set<string>();
  for (let guard = 0; chosen.size < want && guard < 500; guard++) {
    // Every chosen category gets at least one item first.
    const category = guard < categories.length ? categories[guard] : pick(rng, categories);
    const all = interestsByCategory(category).map((i) => i.code);
    if (all.filter((code) => chosen.has(code)).length >= MAX_PER_CATEGORY) continue;
    const preferred = all.filter((code) => tribe.includes(code) && !chosen.has(code));
    chosen.add(chance(rng, 0.7) && preferred.length ? pick(rng, preferred) : pick(rng, all));
  }
  return [...chosen];
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
      // Validated with a real-looking mobile; the stored number is an obviously fake one.
      whatsapp: '+351912345678',
      instagram: chance(rng, 0.8) ? key : '', // ~20% without Instagram (optional)
      city: pick(rng, CITIES),
      lang,
      age: 18 + Math.floor(rng() * rng() * 30), // mostly in their twenties
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
    return { ...result.data, whatsapp: `+351900${String(100000 + i)}` };
  });
}

function score(rng: () => number, mean: number): number {
  // Sum of uniforms ≈ normal; spread ~1.2 points.
  const noise = (rng() + rng() + rng() - 1.5) * 1.6;
  return Math.max(1, Math.min(7, Math.round(mean + noise)));
}

// One review answer. Compatible matches and more shared items do slightly better.
export function seedReview(rng: () => number, type: 'compatible' | 'control', sharedCount: number, askInstagram = false): Review {
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
    ig_follow: askInstagram
      ? talked
        ? pick(rng, ['both', 'both', 'me', 'them', 'none'] as const)
        : pick(rng, ['none', 'none', 'none', 'me', 'them'] as const)
      : undefined,
    comment: chance(rng, 0.15) ? pick(rng, ['Foi giro!', 'Nice chat', 'Combinámos um café', 'Not much in common']) : '',
  };
  const result = validateReview(input, { askInstagram });
  if (!result.ok) throw new Error(`invalid seed review: ${JSON.stringify(result.errors)}`);
  return result.data;
}
