-- BLOP Match — review question: does the person see themselves as introverted, extroverted or a
-- bit of both. Null on reviews sent before.
begin;

alter table public.reviews add column personality text check (personality in ('introvert', 'extrovert', 'both'));

commit;
