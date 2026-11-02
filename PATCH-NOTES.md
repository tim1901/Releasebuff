Releasebuff v0.2.0 — Netlify runtime preflight patch

Files replaced:
- lib/session-store.ts
- .gitignore

Changes:
- Detect Netlify Functions at runtime using SITE_ID and URL as well as NETLIFY / NETLIFY_DEV. Netlify documents NETLIFY as a build-time variable, while SITE_ID and URL are available at function runtime. This allows the integration store to choose Netlify Blobs in production rather than the production-disabled local-file fallback.
- Ignore .netlify/ local CLI metadata so it is not accidentally added to the source repository.

After applying, run:
  npm run typecheck
  npm test
  npm run lint
  npm run build
  npm audit

Do not commit .env.local or any provider credentials.
