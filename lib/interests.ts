export type Category = 'music' | 'sports' | 'food' | 'hobbies';

export type Interest = { code: string; category: Category; en: string; pt: string };

export const CATEGORIES: Category[] = ['music', 'sports', 'food', 'hobbies'];

export const MIN_PER_CATEGORY = 3;
export const MAX_PER_CATEGORY = 6;

export const INTERESTS: Interest[] = [
  // music
  { code: 'music_rock', category: 'music', en: 'Rock', pt: 'Rock' },
  { code: 'music_pop', category: 'music', en: 'Pop', pt: 'Pop' },
  { code: 'music_indie', category: 'music', en: 'Indie', pt: 'Indie' },
  { code: 'music_electronic', category: 'music', en: 'Electronic', pt: 'Eletrónica' },
  { code: 'music_hiphop', category: 'music', en: 'Hip-hop & Rap', pt: 'Hip-hop e Rap' },
  { code: 'music_funk', category: 'music', en: 'Funk', pt: 'Funk' },
  { code: 'music_sertanejo', category: 'music', en: 'Sertanejo', pt: 'Sertanejo' },
  { code: 'music_mpb', category: 'music', en: 'MPB & Samba', pt: 'MPB e Samba' },
  { code: 'music_fado', category: 'music', en: 'Fado', pt: 'Fado' },
  { code: 'music_latin', category: 'music', en: 'Reggaeton & Latin', pt: 'Reggaeton e Latina' },
  { code: 'music_jazz', category: 'music', en: 'Jazz & Blues', pt: 'Jazz e Blues' },
  { code: 'music_metal', category: 'music', en: 'Metal', pt: 'Metal' },
  { code: 'music_classical', category: 'music', en: 'Classical', pt: 'Clássica' },
  { code: 'music_kpop', category: 'music', en: 'K-pop', pt: 'K-pop' },
  // sports
  { code: 'sports_football', category: 'sports', en: 'Football', pt: 'Futebol' },
  { code: 'sports_padel', category: 'sports', en: 'Padel', pt: 'Padel' },
  { code: 'sports_tennis', category: 'sports', en: 'Tennis', pt: 'Ténis' },
  { code: 'sports_running', category: 'sports', en: 'Running', pt: 'Corrida' },
  { code: 'sports_gym', category: 'sports', en: 'Gym', pt: 'Ginásio' },
  { code: 'sports_surf', category: 'sports', en: 'Surf', pt: 'Surf' },
  { code: 'sports_cycling', category: 'sports', en: 'Cycling', pt: 'Ciclismo' },
  { code: 'sports_basketball', category: 'sports', en: 'Basketball', pt: 'Basquete' },
  { code: 'sports_volleyball', category: 'sports', en: 'Volleyball', pt: 'Vólei' },
  { code: 'sports_swimming', category: 'sports', en: 'Swimming', pt: 'Natação' },
  { code: 'sports_climbing', category: 'sports', en: 'Climbing', pt: 'Escalada' },
  { code: 'sports_yoga', category: 'sports', en: 'Yoga & Pilates', pt: 'Yoga e Pilates' },
  { code: 'sports_martial', category: 'sports', en: 'Martial arts', pt: 'Artes marciais' },
  // food
  { code: 'food_japanese', category: 'food', en: 'Japanese', pt: 'Japonesa' },
  { code: 'food_italian', category: 'food', en: 'Italian', pt: 'Italiana' },
  { code: 'food_brazilian', category: 'food', en: 'Brazilian', pt: 'Brasileira' },
  { code: 'food_portuguese', category: 'food', en: 'Portuguese', pt: 'Portuguesa' },
  { code: 'food_mexican', category: 'food', en: 'Mexican', pt: 'Mexicana' },
  { code: 'food_indian', category: 'food', en: 'Indian', pt: 'Indiana' },
  { code: 'food_veggie', category: 'food', en: 'Vegetarian & Vegan', pt: 'Vegetariana e Vegana' },
  { code: 'food_burgers', category: 'food', en: 'Burgers', pt: 'Hambúrguer' },
  { code: 'food_street', category: 'food', en: 'Street food', pt: 'Comida de rua' },
  { code: 'food_brunch', category: 'food', en: 'Coffee & Brunch', pt: 'Café e Brunch' },
  { code: 'food_wine', category: 'food', en: 'Wine', pt: 'Vinho' },
  { code: 'food_craftbeer', category: 'food', en: 'Craft beer', pt: 'Cerveja artesanal' },
  // hobbies
  { code: 'hob_photo', category: 'hobbies', en: 'Photography', pt: 'Fotografia' },
  { code: 'hob_reading', category: 'hobbies', en: 'Reading', pt: 'Leitura' },
  { code: 'hob_games', category: 'hobbies', en: 'Video games', pt: 'Games' },
  { code: 'hob_travel', category: 'hobbies', en: 'Travel', pt: 'Viajar' },
  { code: 'hob_beach', category: 'hobbies', en: 'Beach', pt: 'Praia' },
  { code: 'hob_hiking', category: 'hobbies', en: 'Hiking & Nature', pt: 'Trilhas e natureza' },
  { code: 'hob_festivals', category: 'hobbies', en: 'Festivals & Concerts', pt: 'Festivais e concertos' },
  { code: 'hob_movies', category: 'hobbies', en: 'Movies & Series', pt: 'Cinema e séries' },
  { code: 'hob_art', category: 'hobbies', en: 'Art & Museums', pt: 'Arte e museus' },
  { code: 'hob_dance', category: 'hobbies', en: 'Dancing', pt: 'Dança' },
  { code: 'hob_instruments', category: 'hobbies', en: 'Playing music', pt: 'Tocar instrumentos' },
  { code: 'hob_volunteer', category: 'hobbies', en: 'Volunteering', pt: 'Voluntariado' },
  { code: 'hob_languages', category: 'hobbies', en: 'Languages', pt: 'Idiomas' },
  { code: 'hob_bars', category: 'hobbies', en: 'Bars', pt: 'Bares' },
  { code: 'hob_clubbing', category: 'hobbies', en: 'Clubbing', pt: 'Discoteca' },
  { code: 'hob_dinners', category: 'hobbies', en: 'Dinners out', pt: 'Jantares fora' },
  { code: 'hob_terraces', category: 'hobbies', en: 'Terraces & Cafés', pt: 'Esplanadas' },
  { code: 'hob_cooking', category: 'hobbies', en: 'Cooking at home', pt: 'Cozinhar em casa' },
  { code: 'hob_knitting', category: 'hobbies', en: 'Knitting', pt: 'Tricô' },
];

const BY_CODE = new Map(INTERESTS.map((i) => [i.code, i]));

export function interestByCode(code: string): Interest | undefined {
  return BY_CODE.get(code);
}

export function interestsByCategory(category: Category): Interest[] {
  return INTERESTS.filter((i) => i.category === category);
}
