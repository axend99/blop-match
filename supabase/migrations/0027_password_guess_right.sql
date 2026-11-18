-- Password game: whether the guess was right, decided when the review is saved. A guess counts
-- when it is the same word as the other person's password in any language (heart = coração),
-- checked by AI on the server; null when the check could not run (the app then falls back to
-- comparing the words ignoring case and accents).
alter table public.reviews add column password_guess_right boolean;
