-- BLOP Match — "What I want to talk about" can be one of the person's own interests
-- (talk_about_code) or free text (talk_about), never both; and content_flags, where the AI
-- moderation records free text that looks obscene/offensive (never blocked; shown on /admin).
-- Anonymisation (data deletion request) now clears: name='[deleted]', email, whatsapp,
-- instagram, talk_about, talk_about_code = null, other_text '{}', active false, deleted_at set,
-- deletes the person's content_flags rows; then the auth user is deleted.
begin;

alter table public.participants
  add column talk_about_code text,
  add constraint participants_talk_about_one check (talk_about is null or talk_about_code is null),
  add constraint participants_talk_about_code_own check (talk_about_code is null or talk_about_code = any(interests));

create table public.content_flags (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id),
  match_id uuid references public.matches (id),
  field text not null,
  text text not null,
  status text not null check (status in ('flagged', 'error')),
  category text,
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index content_flags_open_idx on public.content_flags (created_at) where resolved_at is null;

-- Service role only: RLS on, no policies, and no table privileges for the API roles.
alter table public.content_flags enable row level security;
revoke all on public.content_flags from anon, authenticated;

-- Same as 0004 plus other_talk_about_code (still nothing for anonymised partners).
drop function public.get_my_matches();

create function public.get_my_matches()
returns table (
  match_id uuid,
  created_at timestamptz,
  other_name text,
  other_whatsapp text,
  other_instagram text,
  shared_items text[],
  reviewed_by_me boolean,
  other_deleted boolean,
  other_age_range text,
  other_city text,
  other_interests text[],
  other_talk_about text,
  other_talk_about_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.created_at,
    o.name,
    o.whatsapp,
    o.instagram,
    case when o.deleted_at is null then m.shared_items else '{}'::text[] end,
    exists (select 1 from public.reviews r where r.match_id = m.id and r.reviewer_id = me.id),
    o.deleted_at is not null,
    case when o.deleted_at is null then o.age_range end,
    case when o.deleted_at is null then o.city end,
    case when o.deleted_at is null then o.interests else '{}'::text[] end,
    case when o.deleted_at is null then o.talk_about end,
    case when o.deleted_at is null then o.talk_about_code end
  from public.participants me
  join public.matches m on me.id in (m.a_id, m.b_id)
  join public.participants o on o.id = case when m.a_id = me.id then m.b_id else m.a_id end
  where me.user_id = auth.uid()
  order by m.created_at desc
$$;

revoke execute on function public.get_my_matches() from public, anon;
grant execute on function public.get_my_matches() to authenticated;

commit;
