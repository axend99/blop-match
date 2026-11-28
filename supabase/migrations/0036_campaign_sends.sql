-- One-off e-mail campaigns sent from /admin to a pasted list of addresses (e.g. the party invite).
-- One row per campaign and mailbox (canonical address), written before sending, so nobody gets the
-- same campaign twice even if the button is pressed again; removed if the send fails.
create table public.campaign_sends (
  campaign text not null,
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (campaign, email)
);
alter table public.campaign_sends enable row level security;
