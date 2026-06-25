-- Hands Off Web Agency — leads state machine
-- Run in Supabase SQL editor before demo

create type lead_status as enum (
  'NEW', 'BUILDING', 'SITE_READY', 'CONTACTED', 'INTERESTED', 'INVOICED', 'PAID', 'FAILED'
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  full_address text,
  phone text not null,
  niche text,
  google_place_id text,
  status lead_status default 'NEW',
  deployment_url text,
  paypal_order_id text,
  paypal_checkout_url text,
  wassist_reply_callback text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index leads_phone_unique on leads (phone);
create unique index leads_google_place_id_unique on leads (google_place_id) where google_place_id is not null;

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- Demo safety: 2 backup London leads (replace phones with numbers you control)
insert into leads (name, full_address, phone, niche, status) values
  ('Camden Corner Cafe', '12 Camden High St, London NW1 0JH', '+447700900001', 'cafe', 'NEW'),
  ('Shoreditch Plumbing Co', '45 Brick Lane, London E1 6PU', '+447700900002', 'plumber', 'NEW')
on conflict (phone) do nothing;
