# Releasebuff — local-first product intelligence and story drafting

Releasebuff helps solo builders and indie hackers understand their own product work, discover meaningful evidence-backed stories, interview the builder when context is missing, and turn the resulting Story Brief into natural social posts they can review and publish through Buffer.

This is an evolving local-first MVP. It includes a Next.js App Router UI and server routes. Browser data is stored in IndexedDB; small preferences are mirrored to localStorage. Integration secrets are never stored in browser storage.

## Product experience in this rebuild

- **Product onboarding:** product name and plain-language description, audience, product stage, goals, writing voice, optional product website, public repository URL or GitHub App connection.
- **Product Intelligence Profile:** creates an initial source-attributed profile from builder input, repository context and supplied materials; unknowns remain explicit.
- **Source intake:** paste public HTTPS URLs, upload PRDs/documents or screenshots, and save builder notes. Current upload formats are PDF, PNG/JPG/WebP screenshots, TXT, Markdown/MDX, JSON, CSV, HTML and XML. DOCX should be exported to PDF or its relevant text pasted for the MVP.
- **GitHub:** public repository scans work by URL. A GitHub App integration supports read-only access to selected repositories, including private repositories, once configured.
- **Evidence-first Story Inbox:** up to 16 story categories across product progress, learning and craft, product marketing, and audience and growth. No-evidence generic prompts are not injected into the discovered Story Inbox.
- **Story interview:** category-aware, multi-question interview. It asks one question at a time, can follow up, skips known context, records answers locally, and offers a guided fallback when no OpenAI API key is configured.
- **Story Brief and Draft Studio:** OpenAI-backed story drafting when configured; product profile, evidence, interview answers, voice and optional custom opening/closing preferences inform the draft. A rule-based grounded template is labelled as such when AI is unavailable.
- **Claim review:** the draft UI surfaces heuristics-based review warnings for unsupported numbers, causal impact and customer-reaction claims. These warnings are prompts for human review, not a formal fact-check guarantee.
- **Buffer:** OAuth connection, channel selection, save-draft, schedule and publish-now route handlers. They require a registered Buffer OAuth app and an authorized account; a successful UI state is only set after a successful API response.
- **Local project storage:** profile, materials, evidence, stories, interviews, dismissals and drafts use IndexedDB with migration/compatibility mirrors for earlier localStorage values.
- **Storage architecture:** no traditional relational database is required for the MVP. During ordinary `npm run dev`, encrypted provider integration records use `.data/integration-state`. On Netlify, the same records are stored encrypted in Netlify Blobs. Product documents and drafts remain browser-local.

## Prerequisites

- Node.js 20.9+ (Node 22 recommended)
- npm 10+
- Internet access to install packages, scan GitHub, use OpenAI, or call Buffer

## Local setup

1. Extract the ZIP into a new folder and open Terminal in the `releasebuff-app` directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Generate a new session-encryption key:

   ```bash
   openssl rand -base64 32
   ```

   Paste the output into `SESSION_ENCRYPTION_KEY` in `.env.local`. Keep this value private; do not paste it into chat or commit `.env.local`.

5. Start Releasebuff:

   ```bash
   npm run dev
   ```

6. Open <http://localhost:3000>. Start from **Get started** to describe a product, add optional sources, and create a Product Profile. **Explore the agent** loads sample Trellis stories; those are illustrative demo stories and do not run a live GitHub scan.

Before calling the rebuild ready for continued development, run:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## OpenAI (optional, recommended for product analysis and story drafting)

Set these values in `.env.local`:

```dotenv
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-6.1-terra
```

Restart the dev server after changing environment variables. The app calls the OpenAI Responses API from server-side routes and sets `store: false` on one-shot requests. API usage is billed separately from a ChatGPT subscription. If you do not configure an API key, product understanding returns a local, source-limited profile; story generation uses evidence rules; the interview uses a guided question sequence; and drafting uses a clearly labelled grounded template instead of claiming it used AI.

When AI is enabled, material text, relevant repository evidence, story context and interview answers may be sent to the configured OpenAI API to perform the action you requested. For images/PDFs, the client limits media attached to a single request to one small file; files not attached to that request remain stored locally. Do not upload credentials, secrets, customer personal information or material you are not authorized to share with the AI provider.

## GitHub App and private repositories (optional)

Public repository URL scanning works without GitHub authorization. To enable private repositories, register a GitHub App with read-only repository permissions for the metadata, contents, pull requests and issues Releasebuff uses. Avoid write, administration, actions, secrets or workflow permissions.

Configure **two distinct callback URLs** in the GitHub App settings:

- **User authorization callback URL:** `http://localhost:3000/api/github/oauth/callback`
- **Setup URL:** `http://localhost:3000/api/github/callback`

For local tests, set `APP_BASE_URL=http://localhost:3000` and configure `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG` and `GITHUB_APP_PRIVATE_KEY` in `.env.local`. Paste the PEM private key as one line with escaped `\n` sequences when using dotenv, or use an appropriate multiline value in your hosting provider. If GitHub doesn't accept localhost as the configured OAuth callback, use an HTTPS preview deployment for the authorization test.

Example environment values:

```dotenv
APP_BASE_URL=http://localhost:3000
GITHUB_APP_CLIENT_ID=your-github-app-client-id
GITHUB_APP_CLIENT_SECRET=your-github-app-client-secret
GITHUB_APP_ID=your-github-app-id
GITHUB_APP_SLUG=your-github-app-slug
GITHUB_APP_PRIVATE_KEY=-----BEGIN...\n...\n-----END...
```

The connection flow first authenticates the GitHub user, then sends them to install/configure the GitHub App. When GitHub returns the `installation_id`, Releasebuff verifies that the authenticated user's accessible-installations list includes that ID before storing it. This prevents Releasebuff from treating an unverified `installation_id` query parameter as proof that the installation belongs to the current user. The temporary user token is encrypted server-side and expires after ten minutes.

Install the GitHub App only for the repositories you want Releasebuff to access. In Project Setup, select **Connect GitHub**, choose which repositories the App can access, enter the repository URL, enable the GitHub App access option for that repository, and scan. The backend checks that the selected repository belongs to the connected installation and obtains short-lived installation tokens server-side. Releasebuff does not need GitHub write access.

Private repository contents are sensitive. Releasebuff submits relevant excerpts to OpenAI only when an AI-enabled profile/story-discovery/draft action uses those sources. Review the materials before submitting and don't upload secrets or credentials. Use **Disconnect GitHub** to remove the local integration record; disconnection does not necessarily uninstall the GitHub App from your GitHub account.

## Buffer OAuth and publishing (optional)

1. Register a Buffer OAuth app and configure the exact callback URL below.
2. Add the OAuth credentials to `.env.local`:

   ```dotenv
   APP_BASE_URL=http://localhost:3000
   BUFFER_CLIENT_ID=your-client-id
   BUFFER_CLIENT_SECRET=your-client-secret
   BUFFER_REDIRECT_URI=http://localhost:3000/api/buffer/callback
   BUFFER_SCOPES=account:read posts:write offline_access
   ```

3. Ensure `SESSION_ENCRYPTION_KEY` has a strong, newly generated value and restart the server.
4. Select **Sign in with Buffer** / **Connect Buffer**, complete consent, and confirm the real authorized channels are loaded.
5. Test **Save draft to Buffer** with a low-risk post. Then try scheduling for a near-future time on a test channel. Test publish-now only when you are comfortable with the selected destination.

Releasebuff implements Buffer OAuth Authorization Code + PKCE. It requests only the scopes needed for account and post operations. Publishing actions require explicit confirmation in the UI. A post is shown as successfully saved/published/scheduled only after Buffer responds successfully.

## Netlify deployment setup

1. Import this GitHub repository into Netlify. The build command is `npm run build` (configured in `netlify.toml`); let Netlify's maintained Next.js adapter handle the App Router and Route Handlers. Do not configure this project as a static export.
2. In the Netlify site's environment-variable settings, set `APP_BASE_URL` to the site's full HTTPS origin (for example, `https://your-site-name.netlify.app`) and set `SESSION_ENCRYPTION_KEY` to a newly generated secret from `openssl rand -base64 32`. Add `OPENAI_API_KEY` only if you want AI-backed analysis and drafting. Add the GitHub App and Buffer variables only if you intend to enable those integrations.
3. For Buffer in a deployed site, set `BUFFER_REDIRECT_URI` to `https://your-site-name.netlify.app/api/buffer/callback` and configure that exact URL in the Buffer OAuth app. For the GitHub App, configure the user-authorization callback as `https://your-site-name.netlify.app/api/github/oauth/callback` and the setup URL as `https://your-site-name.netlify.app/api/github/callback`. Replace the example hostname with the final Netlify site hostname.
4. Keep all real credentials in Netlify's environment-variable settings, never in GitHub. `.env.example` contains blank placeholders for local setup; use `cp .env.example .env.local` locally, then set the values you need. Do not commit `.env.local`.

### Integration token storage and production caveat

During `npm run dev`, encrypted integration records are written under `.data/integration-state/`; the encryption key is kept in `.env.local`, and `.data/` is gitignored. Production mode refuses this local-file fallback. In Netlify's runtime, Releasebuff selects Netlify Blobs via `@netlify/blobs` when `SITE_ID` and `URL` are present, or when `NETLIFY=true` / `NETLIFY_DEV=true`. Configure environment variables on the site, never in the repository. You do not need to provision a relational database.

**Important limitation before public multi-user launch:** Buffer refresh tokens rotate and are single-use. The current refresh coordination is process-local. Netlify Blobs provides persistence but not a distributed transaction/lock, so simultaneous refresh attempts across separate function instances are not fully serialized by this prototype. Before serving meaningful production traffic, add a cross-instance refresh lease/lock or another coordination mechanism, and test concurrent refresh behaviour. This rebuild is meant for local validation and controlled integration testing, not a claim that the OAuth flow has passed production concurrency testing.

## Public-source intake and safety

Public URL intake accepts HTTPS pages and extracts readable text under a size cap. It rejects credentials in URLs, local/private IP targets and redirects. Sites may still block server-side retrieval; when that happens, paste the relevant public text instead. Uploaded originals are kept in the browser's IndexedDB; only the subset included in a requested AI operation is sent to OpenAI.

The Story Inbox is evidence-driven, but source evidence does not automatically prove deployment, customer impact, revenue or causation. A merged pull request indicates merged code; a published release indicates a published release entry; a roadmap indicates intent. Review claims before publishing.

## Local data and backup

The app keeps project data in the browser's IndexedDB. It is not synced across browsers/devices. Clearing browser storage or losing the device can remove local projects and drafts; exported-project backup/import is planned but is not complete in this rebuild. Do not treat browser-local storage as a durable cloud backup.

## Commands

```bash
npm run dev        # local development server
npm run build      # optimized production build
npm start          # serve a production build locally
npm test           # automated unit tests
npm run typecheck  # TypeScript check
npm run lint       # ESLint check
```

## Suggested local test sequence

1. Visit the landing page and open Project Setup.
2. Enter a product name and description with no website or repository; create the Product Profile.
3. Add a public documentation/changelog URL, paste a builder note, or upload a small PDF/screenshot; rebuild the profile and confirm the sources are listed.
4. Scan a public repository. Confirm every generated Story Inbox card has source evidence and that merged pull requests are not automatically described as deployed.
5. Open a story, complete multiple interview questions, and verify the interview summary is included in the draft context.
6. In Draft Studio, set a custom opening and/or closing, generate a draft, review warnings, save locally, reload the app and confirm the draft remains.
7. Test Buffer only after registering/connecting a real OAuth app. Test draft, schedule and publish-now separately.
8. Test private GitHub only after configuring and installing your own GitHub App with minimum read-only permissions.
