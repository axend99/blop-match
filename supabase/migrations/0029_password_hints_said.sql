-- Password game, round 2:
-- password_kind: the word's type (noun, verb, adjective, other), set by AI when the password is
--   saved; shown to the match as a hint with the number of letters. null if the check failed.
-- password_said: in the review, how many times the person managed to say their password (0–3, where
--   3 means 3 or more); +1 point each. Replaces the "survived" points, which rewarded not talking.
begin;
alter table public.participants add column password_kind text check (password_kind in ('noun', 'verb', 'adjective', 'other'));
alter table public.reviews add column password_said smallint check (password_said between 0 and 3);
update public.participants set password_kind = 'noun' where password = 'carrossel';
commit;
