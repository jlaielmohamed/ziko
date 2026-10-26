# Ziko Hairstyle

A responsive barbershop booking website and private studio dashboard for Ziko Hairstyle in Sfax.

## Run locally

1. Install Node.js 20.19 or later.
2. Copy the example environment file to `.env`; set the Supabase project URL and publishable/anon key, and set `ADMIN_EMAIL` to the admin account email.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:3000`.

The start command builds the multi-page frontend with Vite and serves it from Express. Appointment requests remain in `data/bookings.xlsx`; that file is intentionally ignored by Git. When Supabase is configured, the service menu, overview settings (barbers, weekly hours, and shop details), and blocked dates are read from and saved to Supabase. Without Supabase configuration, the app uses `data/shop-config.json` for local development.

## Supabase admin access

The public booking site works without Supabase. Admin sign-in requires a Supabase project.

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
2. In the Supabase SQL editor, run [supabase/schema.sql](supabase/schema.sql). It creates `services`, `overview`, and `blocked_dates`, seeds them with the current shop settings, and also creates the admin allowlist.
3. Create the admin account in Supabase Auth.
4. Add its Auth user UUID to `public.admin_users`, for example:
   `insert into public.admin_users (user_id) values ('YOUR_AUTH_USER_UUID');`
5. Rebuild/restart with `npm start`.

Admin access requires the signed-in Supabase Auth email to match `ADMIN_EMAIL`, and the user UUID must also appear in the admin allowlist. Row level security allows public reads of the service menu, overview settings, and blocked dates, and limits changes to allowlisted admins. The server independently checks the Supabase Auth session and allowlist before serving the dashboard or admin APIs. The publishable/anon key is intended for browser use; do not place a Supabase service-role key in the frontend or commit credentials.

## Features

- Public barber service menu populated from the shop settings
- Appointment booking with barber, date, live availability and customer details
- Admin login using Supabase Auth and the admin allowlist
- Protected appointments dashboard with status updates and revenue overview
- Admin service editor, weekly business hours, blocked dates, barber roster and shop details
- Appointment workbook preserved at `data/bookings.xlsx`; dashboard revenue totals are derived from it

The admin dashboard is served only after the server confirms the signed-in account is on the admin allowlist. Configure production HTTPS and set `NODE_ENV=production` so the session cookie is Secure.
