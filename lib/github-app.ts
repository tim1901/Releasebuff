import "server-only";
import { createSign } from "node:crypto";

const API_ROOT = "https://api.github.com";
type TokenCacheItem = { token: string; expiresAt: number };
const tokenCache = new Map<number, TokenCacheItem>();

function env(name: string): string { return (process.env[name] ?? "").trim(); }
export function isGitHubAppConfigured(): boolean {
  return Boolean(env("GITHUB_APP_ID") && env("GITHUB_APP_SLUG") && env("GITHUB_APP_PRIVATE_KEY") && env("GITHUB_APP_CLIENT_ID") && env("GITHUB_APP_CLIENT_SECRET"));
}
function base64url(value: string | Buffer): string { return Buffer.from(value).toString("base64url"); }
function appJwt(): string {
  const appId = env("GITHUB_APP_ID");
  const privateKey = env("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new Error("GitHub App is not configured. Add GITHUB_APP_ID, GITHUB_APP_SLUG and GITHUB_APP_PRIVATE_KEY to .env.local.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 30, exp: now + 8 * 60, iss: appId }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
}
async function githubRequest<T>(path: string, options: { method?: string; token: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Releasebuff/0.2",
      Authorization: `Bearer ${options.token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    const errors: Record<number, string> = {
      401: "GitHub rejected the app credentials. Check the GitHub App configuration.",
      403: "GitHub denied access. Confirm that the app has read-only access to this repository and was installed for it.",
      404: "Repository not found or not included in the connected GitHub App installation.",
      422: "GitHub could not complete that app request. Check the selected installation and permissions."
    };
    throw Object.assign(new Error(errors[response.status] ?? `GitHub returned ${response.status}. Try again.`), { status: response.status });
  }
  return response.json() as Promise<T>;
}
export async function createInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const jwt = appJwt();
  const result = await githubRequest<{ token: string; expires_at: string }>(`/app/installations/${installationId}/access_tokens`, { method: "POST", token: jwt, body: {} });
  const expiresAt = Date.parse(result.expires_at);
  if (!result.token || !Number.isFinite(expiresAt)) throw new Error("GitHub returned an invalid installation token response.");
  tokenCache.set(installationId, { token: result.token, expiresAt });
  return result.token;
}

export function githubOAuthCallbackUrl(): string {
  const configured = env("APP_BASE_URL");
  if (!configured) throw new Error("Set APP_BASE_URL before configuring GitHub OAuth.");
  const base = new URL(configured);
  return new URL("/api/github/oauth/callback", base).toString();
}

export function githubUserAuthorizationUrl(state: string): string {
  const clientId = env("GITHUB_APP_CLIENT_ID");
  if (!clientId) throw new Error("GitHub App Client ID is missing.");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", githubOAuthCallbackUrl());
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGitHubUserCode(code: string): Promise<string> {
  const clientId = env("GITHUB_APP_CLIENT_ID");
  const clientSecret = env("GITHUB_APP_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("GitHub App OAuth client credentials are missing.");
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: githubOAuthCallbackUrl() }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({})) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) throw new Error("GitHub sign-in could not be completed. Please restart the connection flow.");
  return data.access_token;
}

export async function verifyInstallationAccessibleToUser(userAccessToken: string, installationId: number): Promise<boolean> {
  if (!Number.isSafeInteger(installationId) || installationId < 1) return false;
  // GitHub explicitly warns that the installation_id in the setup redirect is
  // untrusted. Bind it to the authenticated user's accessible installations.
  for (let page = 1; page <= 10; page++) {
    const result = await githubRequest<{ installations?: Array<{ id: number }> }>(`/user/installations?per_page=100&page=${page}`, { token: userAccessToken });
    const installations = result.installations ?? [];
    if (installations.some(item => item.id === installationId)) return true;
    if (installations.length < 100) return false;
  }
  return false;
}

export interface GitHubInstalledRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  updated_at: string;
}
export async function listInstallationRepositories(installationId: number): Promise<GitHubInstalledRepository[]> {
  const token = await createInstallationToken(installationId);
  const all: GitHubInstalledRepository[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await githubRequest<{ repositories?: GitHubInstalledRepository[]; total_count?: number }>(`/installation/repositories?per_page=100&page=${page}`, { token });
    const current = result.repositories ?? [];
    all.push(...current);
    if (current.length < 100 || all.length >= (result.total_count ?? all.length)) break;
  }
  return all;
}
export async function getInstallationTokenForRepository(installationId: number, owner: string, repo: string): Promise<string> {
  const repos = await listInstallationRepositories(installationId);
  if (!repos.some(item => item.full_name.toLowerCase() === `${owner}/${repo}`.toLowerCase())) {
    throw Object.assign(new Error("This repository isn't available to the connected GitHub App. Choose it when installing the app, or update the app's repository access on GitHub."), { status: 403 });
  }
  return createInstallationToken(installationId);
}
