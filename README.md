# Ziko Hairstyle

A responsive barbershop booking website and private studio dashboard for Ziko Hairstyle in Sfax.

## Run locally

1. Install Node.js 20.19 or later.
2. Copy `.env.example` to `.env` and set the Supabase project URL and publishable/anon key.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:3000`.

The start command builds the multi-page frontend with Vite and serves it from Express. Booking requests and shop configuration are stored locally under `data/`; those files are intentionally ignored by Git.

## Supabase admin access

The public booking site works without Supabase. Admin sign-in requires a Supabase project.

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
2. In the Supabase SQL editor, run [supabase/schema.sql](supabase/schema.sql).
3. Create the admin account in Supabase Auth.
4. Add its Auth user UUID to `public.admin_users`, for example:
   `insert into public.admin_users (user_id) values ('YOUR_AUTH_USER_UUID');`
5. Rebuild/restart with `npm start`.

The only application table in Supabase is `public.admin_users`, an allowlist for admin accounts. Row level security permits an authenticated user to read only their own allowlist row. The server independently checks the Supabase Auth session and allowlist before serving the dashboard or admin APIs. The publishable/anon key is intended for browser use; do not place a Supabase service-role key in the frontend or commit credentials.

## Features

- Public barber service menu populated from the shop settings
- Appointment booking with barber, date, live availability and customer details
- Admin login using Supabase Auth and the admin allowlist
- Protected appointments dashboard with status updates and revenue overview
- Admin service editor, weekly business hours, blocked dates, barber roster and shop details
- Existing appointment workbook preserved at `data/bookings.xlsx`

The admin dashboard is served only after the server confirms the signed-in account is on the admin allowlist. Configure production HTTPS and set `NODE_ENV=production` so the session cookie is Secure.
