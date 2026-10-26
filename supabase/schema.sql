-- Ziko shop data. Appointment records remain in data/bookings.xlsx.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.services (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(trim(name)) > 0),
  duration_minutes integer not null check (duration_minutes between 5 and 240),
  price numeric(10, 2) not null check (price between 0 and 10000),
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.overview (
  id boolean primary key default true check (id),
  barbers text[] not null default '{}',
  business_hours jsonb not null default '{}'::jsonb,
  shop_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_dates (
  date date primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.services enable row level security;
alter table public.overview enable row level security;
alter table public.blocked_dates enable row level security;

grant select on public.admin_users to authenticated;
grant select on public.services, public.overview, public.blocked_dates to anon, authenticated;
grant insert, update, delete on public.services, public.overview, public.blocked_dates to authenticated;

drop policy if exists "Admin can read own allowlist entry" on public.admin_users;
create policy "Admin can read own allowlist entry" on public.admin_users
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Public can read services" on public.services;
create policy "Public can read services" on public.services for select to anon, authenticated using (true);
drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services" on public.services for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "Public can read overview" on public.overview;
create policy "Public can read overview" on public.overview for select to anon, authenticated using (true);
drop policy if exists "Admins manage overview" on public.overview;
create policy "Admins manage overview" on public.overview for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "Public can read blocked dates" on public.blocked_dates;
create policy "Public can read blocked dates" on public.blocked_dates for select to anon, authenticated using (true);
drop policy if exists "Admins manage blocked dates" on public.blocked_dates;
create policy "Admins manage blocked dates" on public.blocked_dates for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create or replace function public.save_shop_config(
  p_services jsonb,
  p_barbers text[],
  p_business_hours jsonb,
  p_shop_settings jsonb,
  p_blocked_dates date[]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  delete from public.services;
  insert into public.services (id, name, duration_minutes, price, description, sort_order)
  select x.id, x.name, x.duration_minutes, x.price, x.description, x.sort_order
  from jsonb_to_recordset(p_services) as x(
    id text, name text, duration_minutes integer, price numeric, description text, sort_order integer
  );

  insert into public.overview (id, barbers, business_hours, shop_settings, updated_at)
  values (true, p_barbers, p_business_hours, p_shop_settings, now())
  on conflict (id) do update set barbers = excluded.barbers,
    business_hours = excluded.business_hours, shop_settings = excluded.shop_settings,
    updated_at = excluded.updated_at;

  delete from public.blocked_dates;
  insert into public.blocked_dates (date)
  select distinct x from unnest(coalesce(p_blocked_dates, array[]::date[])) as x;
end;
$$;
revoke all on function public.save_shop_config(jsonb, text[], jsonb, jsonb, date[]) from public;
grant execute on function public.save_shop_config(jsonb, text[], jsonb, jsonb, date[]) to authenticated;

-- Initial values migrated from data/shop-config.json.
insert into public.services (id, name, duration_minutes, price, description, sort_order) values
  ('haircut', 'Haircut', 30, 15, 'A clean, considered cut shaped around you.', 0),
  ('beard', 'Beard Trim', 20, 8, 'Clean lines and a balanced shape, finished right.', 1),
  ('both', 'Haircut + Beard', 45, 20, 'The full refresh: cut, beard and a polished finish.', 2),
  ('kids', 'Kids'' Cut', 25, 10, 'A comfortable, patient cut for younger clients.', 3)
on conflict (id) do nothing;

insert into public.overview (id, barbers, business_hours, shop_settings) values (
  true,
  array['Wassime', 'Yacine'],
  '{"0":["10:00","22:00"],"1":["10:00","22:00"],"2":["10:00","22:00"],"3":null,"4":["10:00","22:00"],"5":["10:00","22:00"],"6":["10:00","22:00"]}'::jsonb,
  '{"shopName":"Ziko Hairstyle","location":"Sfax, Tunisia","phone":"+216 29 090 385","email":"mohamedjlaiel4000@gmail.com","instagram":"https://www.instagram.com/ziko_hairstyle/"}'::jsonb
) on conflict (id) do nothing;
