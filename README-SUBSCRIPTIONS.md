# Nabeng Invoice — Subscription Upgrade

This upgrade adds:

- 14-day free trial created from Supabase Auth signup
- Monthly plan: GH₵30 / 30 days
- Annual plan: GH₵300 / 365 days
- Paystack server-side transaction initialization
- Paystack server-side transaction verification
- Paystack signed webhook handling
- Subscription status card and subscription modal
- Subscription reference numbers (`NAB-SUB-...`)
- Invoice editor/PDF/save locking after access expires

## 1. Supabase

Open **Supabase → SQL Editor** and run:

`supabase/subscription_migration.sql`

This creates `invoice_subscriptions`, RLS, the signup trigger, and a backfill for existing users.

## 2. Vercel environment variables

Set these in the Vercel project settings:

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (server only)
- `PAYSTACK_SECRET_KEY` — Paystack secret key (`sk_test_...` while testing, `sk_live_...` for production)
- `APP_URL` — exact deployed site URL, e.g. `https://nabeng-invoice.vercel.app`

Never place `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` in `index.html` or `script.js`.

## 3. Paystack webhook

In Paystack Dashboard, configure the webhook URL:

`https://YOUR-DOMAIN/api/paystack/webhook`

The webhook validates `x-paystack-signature` using HMAC-SHA512 before processing `charge.success`.

## 4. Deploy

Keep these files in the project root:

- `index.html`
- `script.js`
- `style.css`
- `package.json`
- `vercel.json`
- `api/`
- `supabase/`
- your existing `assets/` folder

Then deploy to Vercel.

## 5. Test mode

Use Paystack test keys first. Create a fresh test account and confirm:

1. Account receives a 14-day trial.
2. Dashboard shows the trial and remaining days.
3. Clicking Subscribe opens Paystack.
4. Successful payment returns to the site.
5. `/api/payment/verify` verifies the transaction server-side.
6. Subscription changes to Monthly or Annual.
7. Invoice editor opens while access is active.
8. After expiry, the editor/PDF/save paths are locked and the subscription screen is shown.

## Important behavior

The frontend status is only a user-interface gate. Paystack secret operations are server-side. The database subscription row is the source of truth for access.
