-- Supabase SQL Editor: review existing orders table before running.
create table if not exists public.payment_attempts (
 id uuid primary key,
 order_data jsonb not null,
 amount numeric(12,2) not null check (amount>0),
 token text unique,
 status text not null check(status in ('initiating','pending','paid','failed')),
 payment_id text,
 created_at timestamptz not null default now()
);
alter table public.payment_attempts enable row level security;
-- orders must have payment_attempt_id uuid unique and payment_id text.
-- Check existing orders columns first; then run:
alter table public.orders add column if not exists payment_attempt_id uuid unique;
alter table public.orders add column if not exists payment_id text;
