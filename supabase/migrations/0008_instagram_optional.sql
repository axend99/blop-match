-- BLOP Match — Instagram becomes optional; the review asks who followed whom on Instagram
-- (only when both people have Instagram; null otherwise).
begin;

alter table public.participants drop constraint participants_personal_data;
alter table public.participants add constraint participants_personal_data check (
  deleted_at is not null
  or is_seed
  or (user_id is not null and email is not null and whatsapp is not null)
);

alter table public.reviews add column ig_follow text check (ig_follow in ('me', 'them', 'both', 'none'));

commit;
