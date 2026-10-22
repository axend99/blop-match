export type Category = 'music' | 'sports' | 'fitness' | 'movies' | 'animals' | 'food' | 'activities' | 'hobbies';

export type Interest = { code: string; category: Category; en: string; pt: string };

export const CATEGORIES: Category[] = ['music', 'sports', 'fitness', 'movies', 'animals', 'food', 'activities', 'hobbies'];

// No minimum per category (a category can stay empty); at least MIN_TOTAL items overall,
// spread over at least MIN_CATEGORIES categories.
export const MAX_PER_CATEGORY = 5;
export const MIN_TOTAL = 10;
export const MIN_CATEGORIES = 3;

export const INTERESTS: Interest[] = [
  // music
  { code: 'music_rock', category: 'music', en: 'Rock', pt: 'Rock' },
  { code: 'music_pop', category: 'music', en: 'Pop', pt: 'Pop' },
  { code: 'music_indie', category: 'music', en: 'Indie', pt: 'Indie' },
  { code: 'music_electronic', category: 'music', en: 'Electronic', pt: 'Eletrónica' },
  { code: 'music_techno', category: 'music', en: 'Techno & House', pt: 'Techno e House' },
  { code: 'music_hiphop', category: 'music', en: 'Hip-hop & Rap', pt: 'Hip-hop e Rap' },
  { code: 'music_rnb', category: 'music', en: 'R&B & Soul', pt: 'R&B e Soul' },
  { code: 'music_reggae', category: 'music', en: 'Reggae', pt: 'Reggae' },
  { code: 'music_latin', category: 'music', en: 'Reggaeton & Latin', pt: 'Reggaeton e Latina' },
  { code: 'music_afro', category: 'music', en: 'Kizomba & Afrobeats', pt: 'Kizomba e Afrobeats' },
  { code: 'music_funk', category: 'music', en: 'Funk', pt: 'Funk' },
  { code: 'music_sertanejo', category: 'music', en: 'Sertanejo', pt: 'Sertanejo' },
  { code: 'music_mpb', category: 'music', en: 'MPB', pt: 'MPB' },
  { code: 'music_samba', category: 'music', en: 'Samba & Pagode', pt: 'Samba e Pagode' },
  { code: 'music_fado', category: 'music', en: 'Fado', pt: 'Fado' },
  { code: 'music_jazz', category: 'music', en: 'Jazz & Blues', pt: 'Jazz e Blues' },
  { code: 'music_metal', category: 'music', en: 'Metal', pt: 'Metal' },
  { code: 'music_classical', category: 'music', en: 'Classical', pt: 'Clássica' },
  { code: 'music_kpop', category: 'music', en: 'K-pop', pt: 'K-pop' },
  { code: 'music_lofi', category: 'music', en: 'Lo-fi', pt: 'Lo-fi' },
  // sports
  { code: 'sports_football', category: 'sports', en: 'Football', pt: 'Futebol' },
  { code: 'sports_basketball', category: 'sports', en: 'Basketball', pt: 'Basquetebol' },
  { code: 'sports_volleyball', category: 'sports', en: 'Volleyball', pt: 'Voleibol' },
  { code: 'sports_tennis', category: 'sports', en: 'Tennis', pt: 'Ténis' },
  { code: 'sports_padel', category: 'sports', en: 'Padel', pt: 'Padel' },
  { code: 'sports_surf', category: 'sports', en: 'Surf', pt: 'Surf' },
  { code: 'sports_martial', category: 'sports', en: 'Martial arts', pt: 'Artes marciais' },
  { code: 'sports_boxing', category: 'sports', en: 'Boxing', pt: 'Boxe' },
  { code: 'sports_motorsport', category: 'sports', en: 'Formula 1 & motorsport', pt: 'Fórmula 1 e desportos motorizados' },
  { code: 'sports_handball', category: 'sports', en: 'Handball', pt: 'Andebol' },
  { code: 'sports_rugby', category: 'sports', en: 'Rugby', pt: 'Râguebi' },
  { code: 'sports_skate', category: 'sports', en: 'Skateboarding', pt: 'Skate' },
  // fitness
  { code: 'fit_gym', category: 'fitness', en: 'Gym', pt: 'Ginásio' },
  { code: 'fit_running', category: 'fitness', en: 'Running', pt: 'Corrida' },
  { code: 'fit_cycling', category: 'fitness', en: 'Cycling', pt: 'Ciclismo' },
  { code: 'fit_swimming', category: 'fitness', en: 'Swimming', pt: 'Natação' },
  { code: 'fit_yoga', category: 'fitness', en: 'Yoga & Pilates', pt: 'Yoga e Pilates' },
  { code: 'fit_climbing', category: 'fitness', en: 'Climbing', pt: 'Escalada' },
  { code: 'fit_crossfit', category: 'fitness', en: 'CrossFit', pt: 'CrossFit' },
  { code: 'fit_walking', category: 'fitness', en: 'Walking', pt: 'Caminhadas' },
  { code: 'fit_calisthenics', category: 'fitness', en: 'Calisthenics', pt: 'Calistenia' },
  // movies
  { code: 'movies_comedy', category: 'movies', en: 'Comedy', pt: 'Comédia' },
  { code: 'movies_drama', category: 'movies', en: 'Drama', pt: 'Drama' },
  { code: 'movies_thriller', category: 'movies', en: 'Thriller & suspense', pt: 'Thriller e suspense' },
  { code: 'movies_horror', category: 'movies', en: 'Horror', pt: 'Terror' },
  { code: 'movies_romcom', category: 'movies', en: 'Romantic comedy', pt: 'Comédia romântica' },
  { code: 'movies_scifi', category: 'movies', en: 'Sci-fi', pt: 'Ficção científica' },
  { code: 'movies_fantasy', category: 'movies', en: 'Fantasy', pt: 'Fantasia' },
  { code: 'movies_action', category: 'movies', en: 'Action', pt: 'Ação' },
  { code: 'movies_docs', category: 'movies', en: 'Documentaries', pt: 'Documentários' },
  { code: 'movies_anime', category: 'movies', en: 'Anime & animation', pt: 'Anime e animação' },
  { code: 'movies_truecrime', category: 'movies', en: 'True crime', pt: 'True crime' },
  { code: 'movies_kdrama', category: 'movies', en: 'K-dramas', pt: 'K-dramas' },
  { code: 'movies_reality', category: 'movies', en: 'Reality shows', pt: 'Reality shows' },
  // animals
  { code: 'animals_dogs', category: 'animals', en: 'Dogs', pt: 'Cães' },
  { code: 'animals_cats', category: 'animals', en: 'Cats', pt: 'Gatos' },
  { code: 'animals_wildlife', category: 'animals', en: 'Wildlife', pt: 'Animais selvagens' },
  { code: 'animals_birds', category: 'animals', en: 'Birds', pt: 'Aves' },
  { code: 'animals_horses', category: 'animals', en: 'Horses', pt: 'Cavalos' },
  { code: 'animals_marine', category: 'animals', en: 'Marine life', pt: 'Vida marinha' },
  { code: 'animals_reptiles', category: 'animals', en: 'Reptiles', pt: 'Répteis' },
  { code: 'animals_rodents', category: 'animals', en: 'Rabbits & rodents', pt: 'Coelhos e roedores' },
  // food
  { code: 'food_japanese', category: 'food', en: 'Japanese food', pt: 'Comida japonesa' },
  { code: 'food_italian', category: 'food', en: 'Italian food', pt: 'Comida italiana' },
  { code: 'food_brazilian', category: 'food', en: 'Brazilian food', pt: 'Comida brasileira' },
  { code: 'food_portuguese', category: 'food', en: 'Portuguese food', pt: 'Comida portuguesa' },
  { code: 'food_mexican', category: 'food', en: 'Mexican food', pt: 'Comida mexicana' },
  { code: 'food_indian', category: 'food', en: 'Indian food', pt: 'Comida indiana' },
  { code: 'food_chinese', category: 'food', en: 'Chinese food', pt: 'Comida chinesa' },
  { code: 'food_thai', category: 'food', en: 'Thai food', pt: 'Comida tailandesa' },
  { code: 'food_middleeastern', category: 'food', en: 'Middle Eastern food', pt: 'Comida do Médio Oriente' },
  { code: 'food_veggie', category: 'food', en: 'Vegetarian & vegan food', pt: 'Comida vegetariana e vegana' },
  { code: 'food_seafood', category: 'food', en: 'Seafood', pt: 'Marisco e peixe' },
  { code: 'food_burgers', category: 'food', en: 'Burgers', pt: 'Hambúrgueres' },
  { code: 'food_street', category: 'food', en: 'Street food', pt: 'Comida de rua' },
  { code: 'food_desserts', category: 'food', en: 'Desserts & pastries', pt: 'Doces e pastelaria' },
  { code: 'food_brunch', category: 'food', en: 'Coffee & brunch', pt: 'Café e brunch' },
  { code: 'food_wine', category: 'food', en: 'Wine', pt: 'Vinho' },
  { code: 'food_craftbeer', category: 'food', en: 'Craft beer', pt: 'Cerveja artesanal' },
  { code: 'food_cocktails', category: 'food', en: 'Cocktails', pt: 'Cocktails' },
  // activities
  { code: 'act_hiking', category: 'activities', en: 'Hiking & nature', pt: 'Trilhos e natureza' },
  { code: 'act_beach', category: 'activities', en: 'Beach', pt: 'Praia' },
  { code: 'act_travel', category: 'activities', en: 'Travel', pt: 'Viajar' },
  { code: 'act_bars', category: 'activities', en: 'Bars', pt: 'Bares' },
  { code: 'act_clubbing', category: 'activities', en: 'Clubbing', pt: 'Discoteca' },
  { code: 'act_concerts', category: 'activities', en: 'Concerts & festivals', pt: 'Concertos e festivais' },
  { code: 'act_stayin', category: 'activities', en: 'Staying in', pt: 'Ficar em casa' },
  { code: 'act_gamenights', category: 'activities', en: 'Game nights', pt: 'Noites de jogos' },
  { code: 'act_dinners', category: 'activities', en: 'Dinners out', pt: 'Jantares fora' },
  { code: 'act_terraces', category: 'activities', en: 'Terraces & cafés', pt: 'Esplanadas e cafés' },
  { code: 'act_museums', category: 'activities', en: 'Museums & exhibitions', pt: 'Museus e exposições' },
  { code: 'act_theatre', category: 'activities', en: 'Theatre & stand-up', pt: 'Teatro e stand-up' },
  { code: 'act_picnics', category: 'activities', en: 'Picnics & parks', pt: 'Piqueniques e parques' },
  { code: 'act_roadtrips', category: 'activities', en: 'Road trips', pt: 'Road trips' },
  { code: 'act_volunteer', category: 'activities', en: 'Volunteering', pt: 'Voluntariado' },
  // hobbies
  { code: 'hob_cooking', category: 'hobbies', en: 'Cooking', pt: 'Cozinhar' },
  { code: 'hob_knitting', category: 'hobbies', en: 'Knitting & crochet', pt: 'Tricô e crochet' },
  { code: 'hob_dancing', category: 'hobbies', en: 'Dancing', pt: 'Dançar' },
  { code: 'hob_instrument', category: 'hobbies', en: 'Playing an instrument', pt: 'Tocar um instrumento' },
  { code: 'hob_singing', category: 'hobbies', en: 'Singing', pt: 'Cantar' },
  { code: 'hob_photo', category: 'hobbies', en: 'Photography', pt: 'Fotografia' },
  { code: 'hob_videogames', category: 'hobbies', en: 'Video games', pt: 'Videojogos' },
  { code: 'hob_boardgames', category: 'hobbies', en: 'Board games', pt: 'Jogos de tabuleiro' },
  { code: 'hob_reading', category: 'hobbies', en: 'Reading', pt: 'Leitura' },
  { code: 'hob_writing', category: 'hobbies', en: 'Writing', pt: 'Escrita' },
  { code: 'hob_drawing', category: 'hobbies', en: 'Drawing & painting', pt: 'Desenho e pintura' },
  { code: 'hob_crafts', category: 'hobbies', en: 'Crafts & DIY', pt: 'Artesanato e DIY' },
  { code: 'hob_gardening', category: 'hobbies', en: 'Gardening & plants', pt: 'Jardinagem e plantas' },
  { code: 'hob_languages', category: 'hobbies', en: 'Learning languages', pt: 'Aprender idiomas' },
  { code: 'hob_pottery', category: 'hobbies', en: 'Pottery', pt: 'Cerâmica' },
];

const BY_CODE = new Map(INTERESTS.map((i) => [i.code, i]));

export function interestByCode(code: string): Interest | undefined {
  return BY_CODE.get(code);
}

export function interestsByCategory(category: Category): Interest[] {
  return INTERESTS.filter((i) => i.category === category);
}
