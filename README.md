# Nabeng Invoice — Modular Production Upgrade

This version keeps the uploaded Nabeng Invoice functionality but organizes the JavaScript into feature modules.

## Source structure
- `src/main.js` — application entry point
- `src/runtime.js` — shared runtime/state/config
- `src/style.css` — application styles
- `src/modules/auth.js` — authentication/session
- `src/modules/profile.js` — business profile/logo/signature
- `src/modules/invoices.js` — invoice history/editor lifecycle
- `src/modules/customers.js` — customer management
- `src/modules/analytics.js` — dashboard analytics
- `src/modules/payments.js` — payments/receipts/WhatsApp
- `src/modules/phase4.js` — recurring invoices, expenses, reports
- `src/modules/editor.js` — invoice editor/PDF rendering
- `src/modules/utils.js` — shared invoice helpers
- `src/modules/wire.js` — DOM event wiring
- `src/components/` — small reusable UI helpers

## Development
`npm install` then `npm run dev`

## Production
`npm run build` produces a `dist/` folder with minified, hashed assets and no source maps.

## Important
The Supabase anon key is a public browser key; never replace it with a service-role key. Supabase RLS must enforce data ownership.
