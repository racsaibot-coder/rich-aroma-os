-- Create Cash Management Tables
-- 1. Shifts
create table if not exists public.cash_shifts (
    id uuid default gen_random_uuid() primary key,
    employee_id text, -- ID of employee opening/closing
    opening_amount decimal(10,2) not null,
    closing_amount_declared decimal(10,2),
    expected_amount decimal(10,2),
    discrepancy decimal(10,2),
    status text check (status in ('open', 'closed')) default 'open',
    opened_at timestamp with time zone default now(),
    closed_at timestamp with time zone,
    notes text
);

-- 2. Transactions (Payouts/Drops)
create table if not exists public.cash_transactions (
    id uuid default gen_random_uuid() primary key,
    shift_id uuid references public.cash_shifts(id),
    amount decimal(10,2) not null, -- Negative for payout, Positive for drop
    reason text,
    receipt_url text,
    performed_by text,
    created_at timestamp with time zone default now()
);

-- 3. RLS
alter table public.cash_shifts enable row level security;
alter table public.cash_transactions enable row level security;

-- 4. Policies (Open for now, tighten later)
create policy "Allow Staff Shifts" on public.cash_shifts for all using (true);
create policy "Allow Staff Tx" on public.cash_transactions for all using (true);
