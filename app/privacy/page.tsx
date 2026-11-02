import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Releasebuff",
  description: "How Releasebuff handles project materials, AI requests, GitHub access, and Buffer account connections.",
  robots: { index: true, follow: true }
};

export default function PrivacyPolicyPage() {
  return (
    <main className="privacy-page">
      <article className="privacy-container">
        <a className="privacy-back" href="/">← Back to Releasebuff</a>
        <header className="privacy-header">
          <p className="eyebrow">RELEASEBUFF / PRIVACY</p>
          <h1>Privacy Policy</h1>
          <p className="privacy-updated">Last updated: November 3, 2026</p>
          <p>
            Releasebuff helps builders turn their product work into evidence-based story ideas and social drafts.
            This policy describes what information the current Releasebuff MVP uses, where it is stored, and when
            it is shared with connected services.
          </p>
        </header>

        <section>
          <h2>1. How Releasebuff stores your workspace</h2>
          <p>
            The current MVP does not require a Releasebuff account and does not sync your workspace to a central
            Releasebuff database. Product settings, notes, uploaded source materials, story opportunities, interview
            answers, and drafts are stored in your browser, primarily in IndexedDB, with a small number of preferences
            mirrored to local storage. These items remain on that browser and device unless you remove them or a
            browser/device feature affects its storage.
          </p>
          <p>
            Clearing this site's browser storage can remove local project information and drafts. The current MVP
            does not yet provide cross-device syncing, a cloud workspace, or a built-in export/import backup workflow.
            Keep your own copies of material you cannot afford to lose.
          </p>
        </section>

        <section>
          <h2>2. Information you provide</h2>
          <p>
            Depending on the features you use, Releasebuff may process your product name and description, intended
            audience, goals, product stage, writing preferences, notes, public URLs, uploaded documents or screenshots,
            repository URLs, story interview answers, and draft text. Please do not submit passwords, API keys, private
            credentials, sensitive personal information, or material you are not authorized to use.
          </p>
        </section>

        <section>
          <h2>3. GitHub connections and source material</h2>
          <p>
            You can ask Releasebuff to scan a public GitHub repository by URL without connecting a GitHub account.
            If you configure and install the optional GitHub App, Releasebuff can access only the repositories and
            read permissions you grant that installation, as enforced by GitHub. Releasebuff does not ask for your
            GitHub password.
          </p>
          <p>
            Repository information and relevant excerpts from selected sources may be used to build a profile,
            identify story opportunities, or prepare a draft. If you use an AI-enabled action, relevant excerpts from
            public or private sources may be sent to the configured AI provider as described below. Disconnecting
            GitHub removes the integration record for that Releasebuff session; it does not necessarily uninstall the
            GitHub App from your GitHub account or delete local project data.
          </p>
        </section>

        <section>
          <h2>4. AI processing through OpenAI</h2>
          <p>
            If an OpenAI API key is configured and you request an AI-enabled product analysis, story discovery,
            interview, or draft, Releasebuff sends the relevant context needed for that operation to the configured
            OpenAI API. Depending on the action, that context may include product details, source excerpts, story
            evidence, interview answers, writing preferences, draft text, and a relevant uploaded document or image.
            Original uploaded files otherwise remain in your browser. The app sends these requests from its server
            routes and sets the Responses API one-shot request option <code>store: false</code> where implemented.
          </p>
          <p>
            OpenAI processes those requests under its own terms, privacy documentation, and applicable API data
            controls. Do not assume that the way Releasebuff stores information determines the provider's retention
            or processing practices. If AI is not configured, Releasebuff uses its labelled non-AI fallback paths.
          </p>
        </section>

        <section>
          <h2>5. Buffer connection and publishing</h2>
          <p>
            If you choose to connect Buffer, you are redirected to Buffer to authorize access. Releasebuff uses
            OAuth 2.0 Authorization Code with PKCE. It stores the resulting integration session server-side in
            encrypted form; it does not intentionally store Buffer access or refresh tokens in browser local storage.
            Temporary OAuth state and PKCE cookies help protect the authorization flow, and the session cookie is
            HTTP-only.
          </p>
          <p>
            When you ask Releasebuff to load your channels or save, schedule, or publish a post, it sends the
            information needed for that request to Buffer, such as post text, the chosen channel, and any requested
            schedule time. Generating a draft does not publish it. Saving, scheduling, or publishing requires a
            separate user action and confirmation. Buffer processes connected-account data under Buffer's own
            policies and terms.
          </p>
          <p>
            You can disconnect Buffer inside Releasebuff and may also revoke the app's access in your Buffer
            account settings. Disconnecting removes the stored session record for that Releasebuff session; it does
            not delete your local drafts or any posts already created in Buffer.
          </p>
        </section>

        <section>
          <h2>6. Hosting, security, and cookies</h2>
          <p>
            When deployed, Releasebuff runs on its configured hosting provider. On Netlify, encrypted integration
            records are stored using Netlify Blobs. During local development, encrypted integration records are stored
            under the local <code>.data/integration-state/</code> directory. The application encrypts integration
            records before storage using an application encryption key configured outside the repository. Do not
            commit real environment files or credentials to source control.
          </p>
          <p>
            Releasebuff uses short-lived HTTP-only cookies for OAuth state and PKCE verification and an HTTP-only
            session cookie for connected integrations. Cookies are used for security and integration functionality,
            not for advertising. Hosting or infrastructure providers may process technical request logs and diagnostic
            information as part of providing the service.
          </p>
          <p>
            The interface loads fonts from Google Fonts. When your browser requests those fonts, Google may receive
            technical information such as your IP address and browser request metadata under Google's applicable
            policies.
          </p>
          <p>
            No internet service can guarantee absolute security. Your browser and device security also matter,
            particularly because the project workspace itself is stored locally in your browser.
          </p>
        </section>

        <section>
          <h2>7. Retention and deletion</h2>
          <p>
            Browser workspace data remains in your browser until you delete it or browser/device storage is removed.
            You can clear the site's browser storage to remove local projects and drafts. Connected integration
            records are encrypted and assigned an application expiry (30 days for Buffer sessions and GitHub
            installation records; temporary GitHub authorization records expire sooner). Expired records are removed
            when the application detects them; hosting-provider logs and backups may follow separate retention rules.
          </p>
          <p>
            You can disconnect GitHub or Buffer from within Releasebuff and can revoke authorization directly with
            the relevant provider. Those actions do not automatically remove local workspace data, content already
            sent to an AI provider, posts already created in Buffer, or copies retained under a third-party
            provider's own policies.
          </p>
        </section>

        <section>
          <h2>8. Third-party services</h2>
          <p>
            Depending on the features you use, the relevant third parties may include GitHub (repository access),
            OpenAI (AI-enabled actions), Buffer (connected social publishing), Netlify (hosting and integration
            storage when deployed), and Google Fonts (interface typography). Releasebuff does not control these
            providers' independent services or their privacy practices. Review the policies applicable to services
            you choose to connect.
          </p>
        </section>

        <section>
          <h2>9. Your choices</h2>
          <ul>
            <li>Choose whether to connect GitHub, enable AI-backed actions, or connect Buffer.</li>
            <li>Review generated stories and drafts before sending content to Buffer.</li>
            <li>Avoid uploading confidential material or sending material to a provider unless you are authorized to do so.</li>
            <li>Clear local browser storage and disconnect or revoke third-party integrations when no longer needed.</li>
          </ul>
        </section>

        <section>
          <h2>10. Children and policy changes</h2>
          <p>
            Releasebuff is a builder-focused tool and is not intended for children under 13. The project maintainer
            may update this policy as the service changes; the date above indicates when it was most recently
            revised.
          </p>
        </section>

        <section className="privacy-contact">
          <h2>11. Contact</h2>
          <p>
            For privacy questions or requests, contact the Releasebuff maintainer through the
            {" "}<a href="https://github.com/tim1901" target="_blank" rel="noreferrer">maintainer's GitHub profile</a>.
            Please do not post private personal information or account credentials in public issues.
          </p>
        </section>

        <footer className="privacy-footer">
          <a href="/">Releasebuff home</a>
          <span>Grounded in evidence. Written with the builder.</span>
        </footer>
      </article>
    </main>
  );
}
