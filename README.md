# Nabeng Invoice — Production Build

This project is configured as a Vite production application so the browser receives a small HTML shell and hashed/minified assets, similar to the Kanella structure.

## Build

```bash
npm install
npm run build
```

The deployable site is generated in `dist/`.

## Production result

The generated HTML references assets similar to:

- `/assets/index-XXXXXXXX.js`
- `/assets/index-XXXXXXXX.css`

Source maps are disabled in the production build.

## Deployment

For Vercel, use:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Important security note

Frontend JavaScript can never be completely hidden from a browser. Bundling/minification makes casual copying substantially harder, but Supabase Row Level Security must remain the real authorization boundary. Never put a Supabase `service_role` key in frontend code.
