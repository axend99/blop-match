-- Perceived compatibility: when someone rates a match 1–3 for interest, the review asks why
-- (multiple choice, optional). null when not asked.
alter table public.reviews add column low_interest_reasons text[]
  check (low_interest_reasons <@ array['age', 'gender', 'interests', 'profile', 'not_looking', 'other']::text[]);
