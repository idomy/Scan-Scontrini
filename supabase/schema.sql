-- Schema per scan-scontrini (demo MVP, senza auth)
-- Eseguire nel SQL Editor di Supabase

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  merchant text,
  receipt_date date,
  total numeric(10, 2),
  currency text default 'EUR',
  payment_method text,
  category text,
  items jsonb not null default '[]',
  raw_text text
);

create index if not exists receipts_date_idx on receipts (receipt_date desc);

-- RLS abilitata con policy permissive per anon: scelta consapevole per una
-- demo single-user senza login. In un prodotto reale: auth + policy per user_id.
alter table receipts enable row level security;

create policy "demo_select" on receipts for select using (true);
create policy "demo_insert" on receipts for insert with check (true);
create policy "demo_delete" on receipts for delete using (true);
