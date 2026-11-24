-- Invite a friend: each participant has a short invite code (link /i/<code>); a person who joins
-- through it stores who invited them. +4 leaderboard points per invited friend who joins v2 (chose
-- a password), up to 5 (lib/game.ts). Inviter and invitee are never matched with each other.
begin;
alter table public.participants add column invite_code text unique;
alter table public.participants add column invited_by uuid references public.participants (id) on delete set null;
commit;
