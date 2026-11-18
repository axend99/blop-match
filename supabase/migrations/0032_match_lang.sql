-- The language people want to chat in with their matches (asked in the profile). Matching pairs
-- people by it; `lang` stays the site/e-mail language, which changes with the language switch.
alter table public.participants add column match_lang text check (match_lang in ('pt', 'en'));
update public.participants set match_lang = lang where match_lang is null and lang in ('pt', 'en');
