-- BLOP Match — two questions about the idea itself, in every review: does the person like the
-- concept, and is it better for friendship, dating or both. Null on reviews sent before.
begin;

alter table public.reviews
  add column likes_concept boolean,
  add column best_for text check (best_for in ('friendship', 'dating', 'both'));

commit;
