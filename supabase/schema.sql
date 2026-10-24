-- The single application table in this project is an admin allowlist.
-- Create the admin user in Supabase Auth first, then insert that user's UUID below.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admin_users enable row level security;

grant select on public.admin_users to authenticated;

drop policy if exists "Admin can read own allowlist entry" on public.admin_users;
create policy "Admin can read own allowlist entry"
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
