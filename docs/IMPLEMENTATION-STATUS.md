# Releasebuff implementation status — rebuild v0.2.0

This file distinguishes current source implementation from planned work and configuration-dependent capabilities. It is not a declaration of production readiness.

## Present in the rebuild source

- Next.js App Router with landing page, Project Setup, Story Inbox, Story Details, Story Categories, Draft Studio and Draft Library.
- IndexedDB-first browser persistence for project settings, Product Profile, source materials, evidence-backed stories, interview answers and local drafts, with compatibility reads/writes for selected legacy localStorage keys.
- Product onboarding fields: product name/description, audience, stage, website, goals and writing voice. A public website is optional and may be fetched into the material list.
- Source intake for public HTTPS URLs, pasted builder notes, text-like documents, PDF and small image uploads. Server route enforces basic URL/size/redirect checks.
- Product Profile endpoint which combines builder description, selected repository scan, materials and optional OpenAI analysis; no-key fallback keeps unknowns explicit.
- Public GitHub repository scanner, with summaries of repository metadata, README, PRs, issues, commits and releases. Recent merged-PR changed-file metadata is fetched to improve evidence without sending raw code diffs.
- GitHub App installation and selected-repository routes. The connection flow first obtains a temporary GitHub user token, then verifies the returned installation appears in that user’s accessible-installations list before storing it. Repository access uses server-generated short-lived installation tokens. Both GitHub OAuth client credentials and GitHub App credentials must be configured.
- Rule-driven story candidate engine and OpenAI evidence-constrained story-discovery layer. Discovered stories must cite IDs from actual collected source records; generic no-evidence prompts are removed from the Story Inbox.
- Category-aware adaptive story interview endpoint with AI and guided fallback modes, multi-question answer persistence and a maximum interview length.
- OpenAI Responses API draft generation using the Product Profile, story evidence, builder interview, optional custom opening/closing and writing voice; deterministic fallback is labelled as a grounded template.
- Heuristic draft review warnings for common unsupported number/impact/customer reaction claims. These are review aids, not a complete factual-verification system.
- Buffer OAuth Authorization Code + PKCE routes, account/channel retrieval, save-draft, schedule and publish-now API paths, session-server token handling and UTC scheduling conversion.
- Encrypted provider integration record storage: encrypted local-file fallback during ordinary local development and encrypted Netlify Blobs records under Netlify. No conventional database required.
- Tests for repository URL parsing, story category definitions, date/time handling and AI draft generation request/fallback behavior; an evidence-only story-engine test is maintained alongside the other unit tests.

## Requires developer configuration to exercise

- `SESSION_ENCRYPTION_KEY` for encrypted local integration records.
- `OPENAI_API_KEY` for real AI-assisted Product Profile analysis, story discovery, interviewing and draft writing. Model ID is configured with `OPENAI_MODEL`.
- GitHub App client ID/secret, App ID/slug/private key, User authorization callback URL (`/api/github/oauth/callback`), Setup URL (`/api/github/callback`) and installation with selected repositories for private GitHub scanning.
- Buffer OAuth client ID/secret, exact callback URL, required scopes and a consenting Buffer account for actual channel and post operations.
- Netlify environment variables and Netlify runtime to test the Netlify Blobs integration path. Ordinary `npm run dev` uses the encrypted local-file provider instead.

## Not production complete / deferred

- Continuous/automatic GitHub monitoring and webhook-driven story discovery.
- User accounts, centralized project persistence and cross-device sync.
- Export/import project backups.
- Direct Notion/Linear integrations and direct analytics, customer support or revenue integrations. The MVP supports URLs, notes, documents, screenshots and manually supplied exports where implemented.
- Full claim-level semantic verification, deduplication quality evaluation, editorial scoring and end-to-end evaluations using representative builder projects.
- Cross-instance lock/lease for Buffer refresh-token rotation. The current refresh coordination is process-local; Netlify Blobs is persistence, not a distributed lock or transaction coordinator.
- Actual OAuth, private-repository and Buffer publish/schedule flows have not been tested against the user's own configured provider accounts as part of preparing this source bundle.

## Validation status in this preparation environment

- TypeScript/TSX source syntax is checked with the globally available TypeScript parser.
- Full `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` need to be run after dependencies install successfully. Package installation could not complete in the preparation environment, so do not assume the complete toolchain checks have passed here.
