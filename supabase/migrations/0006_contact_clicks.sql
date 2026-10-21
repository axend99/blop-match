-- BLOP Match — taps on the WhatsApp/Instagram buttons of a match (attempts to start a
-- conversation). One row per (match, person, channel): the first tap. Service role only.
-- Anonymisation also deletes the person's contact_clicks rows.
begin;

create table public.contact_clicks (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  participant_id uuid not null references public.participants (id),
  channel text not null check (channel in ('whatsapp', 'instagram')),
  created_at timestamptz not null default now(),
  unique (match_id, participant_id, channel)
);

alter table public.contact_clicks enable row level security;
revoke all on public.contact_clicks from anon, authenticated;

commit;
