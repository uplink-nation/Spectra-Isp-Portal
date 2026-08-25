-- Schema expected by the ISP usage dashboard.
-- Run this in Supabase SQL Editor, then reload the PostgREST schema cache.

create extension if not exists pgcrypto;

create table if not exists public.plans (
  id text primary key,
  name text not null,
  download_speed_mbps integer not null check (download_speed_mbps > 0),
  upload_speed_mbps integer not null check (upload_speed_mbps > 0),
  price_inr numeric(10, 2) not null check (price_inr >= 0),
  data_limit_gb integer,
  billing_cycle text not null default 'monthly',
  description text,
  is_popular boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  pppoe_username text not null unique,
  is_admin boolean not null default false,
  plan_id text references public.plans(id) on delete set null,
  plan_name text default 'Spectra GigaFiber 300 Mbps Unlimited',
  plan_speed_mbps integer default 300,
  plan_upload_mbps integer default 300,
  plan_price_inr numeric(10, 2) default 999.00,
  plan_data_limit_gb integer,
  plan_renewal_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  pppoe_username text not null,
  session_started_at timestamptz not null,
  session_ended_at timestamptz,
  download_bytes bigint not null default 0 check (download_bytes >= 0),
  upload_bytes bigint not null default 0 check (upload_bytes >= 0),
  total_bytes bigint generated always as (download_bytes + upload_bytes) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_events (
  id uuid primary key default gen_random_uuid(),
  telegram_update_id bigint not null unique,
  chat_id text not null,
  message_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  invoice_number text not null unique,
  plan_name text not null,
  period_start date not null,
  period_end date not null,
  issue_date date not null,
  due_date date not null,
  base_amount numeric(10, 2) not null check (base_amount >= 0),
  cgst_amount numeric(10, 2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(10, 2) not null default 0 check (sgst_amount >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  status text not null default 'paid' check (status in ('paid', 'pending', 'overdue', 'cancelled')),
  payment_method text,
  transaction_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  ticket_code text not null unique,
  category text not null check (category in ('speed', 'disconnection', 'billing', 'router', 'relocation', 'general')),
  subject text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_auth_user_id_idx
  on public.customers(auth_user_id);

create index if not exists usage_sessions_customer_ended_idx
  on public.usage_sessions(customer_id, session_ended_at desc);

create index if not exists invoices_customer_period_idx
  on public.invoices(customer_id, period_start desc);

create index if not exists support_tickets_customer_created_idx
  on public.support_tickets(customer_id, created_at desc);

create table if not exists public.speed_tests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  pppoe_username text not null,
  download_mbps numeric(10, 2) not null check (download_mbps >= 0),
  upload_mbps numeric(10, 2) not null check (upload_mbps >= 0),
  ping_ms numeric(10, 2) not null check (ping_ms >= 0),
  jitter_ms numeric(10, 2) not null check (jitter_ms >= 0),
  server_name text not null default 'Cloudflare Edge',
  server_location text,
  client_ip text,
  isp_name text not null default 'Spectra Fiber',
  grade text not null default 'A+' check (grade in ('A+', 'A', 'B', 'C')),
  engine text not null default 'cloudflare',
  created_at timestamptz not null default now()
);

create index if not exists telegram_events_created_at_idx
  on public.telegram_events(created_at desc);

create index if not exists speed_tests_customer_created_idx
  on public.speed_tests(customer_id, created_at desc);

alter table public.customers enable row level security;
alter table public.usage_sessions enable row level security;
alter table public.invoices enable row level security;
alter table public.support_tickets enable row level security;
alter table public.speed_tests enable row level security;
alter table public.telegram_events enable row level security;

grant select on public.customers to authenticated;
grant select on public.usage_sessions to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.speed_tests to authenticated;

drop policy if exists "Customers can read their own account" on public.customers;
create policy "Customers can read their own account"
  on public.customers
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists "Customers can read their own usage sessions" on public.usage_sessions;
create policy "Customers can read their own usage sessions"
  on public.usage_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = usage_sessions.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Customers can read their own invoices" on public.invoices;
create policy "Customers can read their own invoices"
  on public.invoices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = invoices.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Customers can update their own invoices" on public.invoices;
create policy "Customers can update their own invoices"
  on public.invoices
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = invoices.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Customers can view their own support tickets" on public.support_tickets;
create policy "Customers can view their own support tickets"
  on public.support_tickets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = support_tickets.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Customers can insert their own support tickets" on public.support_tickets;
create policy "Customers can insert their own support tickets"
  on public.support_tickets
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.customers
      where customers.id = support_tickets.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Customers can view their own speed tests" on public.speed_tests;
create policy "Customers can view their own speed tests"
  on public.speed_tests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = speed_tests.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Customers can insert their own speed tests" on public.speed_tests;
create policy "Customers can insert their own speed tests"
  on public.speed_tests
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.customers
      where customers.id = speed_tests.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

-- =========================================================
-- CUSTOMER STATUS & REAL-TIME PRESENCE LOGS (ONLINE/OFFLINE)
-- =========================================================
create table if not exists public.customer_status_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  pppoe_username text not null,
  status text not null check (status in ('ONLINE', 'OFFLINE')),
  event_time timestamptz not null default now(),
  telegram_chat_id bigint,
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists customer_status_logs_cust_idx
  on public.customer_status_logs(customer_id, event_time desc);

alter table public.customer_status_logs enable row level security;

-- Optional columns on customers
alter table public.customers add column if not exists is_online boolean default false;
alter table public.customers add column if not exists last_status_change_at timestamptz;

drop policy if exists "Customers can view their own status logs" on public.customer_status_logs;
create policy "Customers can view their own status logs"
  on public.customer_status_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = customer_status_logs.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

grant select, insert on public.customer_status_logs to authenticated, service_role;

notify pgrst, 'reload schema';


