-- Create Settings Table
create table if not exists public.business_settings (
    id int primary key default 1,
    name text default 'Rich Aroma',
    currency text default 'HNL',
    tax_rate decimal(5,2) default 15.00,
    is_practice_mode boolean default true,
    setup_completed boolean default false
);

-- Enable RLS
alter table public.business_settings enable row level security;

-- Policies
create policy "Read Settings" on public.business_settings for select using (true);
create policy "Update Settings" on public.business_settings for update using (true);
create policy "Insert Settings" on public.business_settings for insert with check (true);

-- Insert Default Row
insert into public.business_settings (id, is_practice_mode) values (1, true)
on conflict (id) do nothing;
