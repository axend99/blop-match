-- BLOP Match — seed data (fake participants for demos and admin testing). Seed rows have no
-- account and no e-mail (no login, no e-mail can ever reach them) and are inserted inactive, so
-- matching, crons and review e-mails never touch them. `npm run seed:clean` removes them.
begin;

alter table public.participants add column is_seed boolean not null default false;

create index participants_seed_idx on public.participants (id) where is_seed;

alter table public.participants drop constraint participants_personal_data;
alter table public.participants add constraint participants_personal_data check (
  deleted_at is not null
  or is_seed
  or (user_id is not null and email is not null and whatsapp is not null and instagram is not null)
);

-- A seed row never has an account or an e-mail, so a real account can never be marked as seed.
alter table public.participants add constraint participants_seed_no_account check (
  not is_seed or (user_id is null and email is null)
);

commit;
