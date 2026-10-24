-- BLOP Match — last review question: "if we organised a party just for BLOP users, to try this
-- in person, would you be interested?" (yes / maybe / no). Builds a list of people to contact for
-- that possible next step. Null on reviews sent before.
begin;

alter table public.reviews add column party_interest text check (party_interest in ('yes', 'maybe', 'no'));

commit;
