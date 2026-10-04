-- NABENG INVOICE SUBSCRIPTIONS
-- Run this once in Supabase SQL Editor.

create table if not exists public.invoice_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'trial' check (plan in ('trial','monthly','annual')),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  trial_start timestamptz not null default now(),
  trial_end timestamptz not null default (now() + interval '14 days'),
  subscription_start timestamptz,
  subscription_end timestamptz,
  amount integer,
  currency text not null default 'GHS',
  paystack_reference text unique,
  subscription_reference text unique,
  paystack_transaction_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_subscriptions_user_id_idx on public.invoice_subscriptions(user_id);
create index if not exists invoice_subscriptions_paystack_reference_idx on public.invoice_subscriptions(paystack_reference);

alter table public.invoice_subscriptions enable row level security;

drop policy if exists "Users can read own invoice subscription" on public.invoice_subscriptions;
create policy "Users can read own invoice subscription"
on public.invoice_subscriptions for select
using (auth.uid() = user_id);

-- Keep updated_at current.
create or replace function public.set_invoice_subscription_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoice_subscriptions_updated_at on public.invoice_subscriptions;
create trigger invoice_subscriptions_updated_at
before update on public.invoice_subscriptions
for each row execute function public.set_invoice_subscription_updated_at();

-- Automatically create the 14-day trial when a Supabase Auth account is created.
create or replace function public.create_invoice_trial_for_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.invoice_subscriptions (user_id,email,plan,status,trial_start,trial_end)
  values (new.id,new.email,'trial','active',now(),now()+interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_invoice_trial on auth.users;
create trigger on_auth_user_created_invoice_trial
after insert on auth.users
for each row execute function public.create_invoice_trial_for_user();

-- Backfill users that existed before this migration.
insert into public.invoice_subscriptions (user_id,email,plan,status,trial_start,trial_end)
select id,email,'trial','active',now(),now()+interval '14 days'
from auth.users
where not exists (select 1 from public.invoice_subscriptions s where s.user_id=auth.users.id);

-- Helper used by server-side code if desired.
create or replace function public.get_invoice_access(p_user_id uuid)
returns table (
  plan text, status text, trial_start timestamptz, trial_end timestamptz,
  subscription_start timestamptz, subscription_end timestamptz,
  subscription_reference text, paystack_reference text, amount integer, currency text,
  access_active boolean
)
language sql
security definer set search_path = public
as $$
  select s.plan,s.status,s.trial_start,s.trial_end,s.subscription_start,s.subscription_end,
         s.subscription_reference,s.paystack_reference,s.amount,s.currency,
         (s.status='active' and (s.plan in ('monthly','annual') and s.subscription_end > now()
           or s.plan='trial' and s.trial_end > now())) as access_active
  from public.invoice_subscriptions s where s.user_id=p_user_id;
$$;
