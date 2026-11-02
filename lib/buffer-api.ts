import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { BufferApiPostResult, BufferChannel, BufferSession } from "@/lib/types";
import { isSessionEncryptionConfigured, readBufferSession, writeBufferSession, persistentIntegrationStoreConfigured } from "@/lib/session-store";

const BUFFER_API_URL = "https://api.buffer.com";
const BUFFER_TOKEN_URL = "https://auth.buffer.com/token";
const CLIENT_ID = () => process.env.BUFFER_CLIENT_ID?.trim();
const CLIENT_SECRET = () => process.env.BUFFER_CLIENT_SECRET?.trim();

export class BufferApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 502, code?: string) {
    super(message);
    this.name = "BufferApiError";
    this.status = status;
    this.code = code;
  }
}

async function tokenRequest(params: URLSearchParams): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string; token_type?: string }> {
  const response = await fetch(BUFFER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: params,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== "string") {
    const code = typeof data.error === "string" ? data.error : "token_exchange_failed";
    if (code === "invalid_grant") throw new BufferApiError("Buffer authorization expired or was already used. Reconnect your Buffer account.", 401, code);
    throw new BufferApiError("Buffer could not complete authorization. Check the OAuth client and redirect URI, then try again.", 502, code);
  }
  return {
    access_token: data.access_token,
    refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : 3600,
    scope: typeof data.scope === "string" ? data.scope : undefined,
    token_type: typeof data.token_type === "string" ? data.token_type : "Bearer"
  };
}

export function isBufferOAuthConfigured(): boolean {
  const appBase = process.env.APP_BASE_URL?.trim();
  const redirectUri = process.env.BUFFER_REDIRECT_URI?.trim();
  let redirectMatchesApp = false;
  try {
    const base = appBase ? new URL(appBase) : process.env.NODE_ENV !== "production" ? new URL("http://localhost:3000") : null;
    redirectMatchesApp = Boolean(base && redirectUri === new URL("/api/buffer/callback", base).toString());
  } catch { /* Invalid URL configuration is not ready for OAuth. */ }
  const baseUrlReady = process.env.NODE_ENV !== "production" || Boolean(appBase);
  // Public Buffer clients use Authorization Code + PKCE without a client secret.
  // A secret is sent only when configured for an existing confidential client.
  return Boolean(CLIENT_ID() && redirectUri && redirectMatchesApp && isSessionEncryptionConfigured() && baseUrlReady && persistentIntegrationStoreConfigured());
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function bufferAuthorizationUrl(state: string, codeChallenge: string): string {
  const clientId = CLIENT_ID();
  const redirectUri = process.env.BUFFER_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) throw new Error("Configure BUFFER_CLIENT_ID and BUFFER_REDIRECT_URI first.");
  const url = new URL("https://auth.buffer.com/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (process.env.BUFFER_SCOPES || "account:read posts:write offline_access").trim());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeAuthorizationCode(code: string, verifier: string): Promise<BufferSession> {
  const clientId = CLIENT_ID(); const clientSecret = CLIENT_SECRET(); const redirectUri = process.env.BUFFER_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) throw new Error("Buffer OAuth environment variables are not configured.");
  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });
  // Buffer public clients must omit client_secret; confidential clients may include it.
  if (clientSecret) params.set("client_secret", clientSecret);
  const data = await tokenRequest(params);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    tokenType: data.token_type,
    connectedAt: new Date().toISOString()
  };
}

export async function getValidBufferSession(sid: string): Promise<BufferSession> {
  const session = await readBufferSession(sid);
  if (!session) throw new BufferApiError("Buffer is not connected. Connect your Buffer account to continue.", 401, "not_connected");
  if (session.expiresAt > Date.now() + 90_000) return session;
  if (!session.refreshToken) throw new BufferApiError("The Buffer session has expired. Reconnect your account.", 401, "reauthorization_required");

  // Single-process refresh guard. For multi-instance production, use a distributed lock alongside the durable store.
  const g = globalThis as typeof globalThis & { __releasebuffRefreshLocks?: Map<string, Promise<BufferSession>> };
  g.__releasebuffRefreshLocks ??= new Map();
  const existing = g.__releasebuffRefreshLocks.get(sid);
  if (existing) return existing;
  const task = (async () => {
    const latest = await readBufferSession(sid);
    if (!latest) throw new BufferApiError("Buffer session not found. Reconnect your account.", 401, "not_connected");
    if (latest.expiresAt > Date.now() + 90_000) return latest;
    if (!latest.refreshToken) throw new BufferApiError("The Buffer session has expired. Reconnect your account.", 401, "reauthorization_required");
    const clientId = CLIENT_ID(); const clientSecret = CLIENT_SECRET();
    if (!clientId) throw new Error("Buffer OAuth client configuration is missing.");
    const refreshParams = new URLSearchParams({ client_id: clientId, grant_type: "refresh_token", refresh_token: latest.refreshToken });
    // Buffer public clients refresh with client_id + refresh_token only.
    if (clientSecret) refreshParams.set("client_secret", clientSecret);
    let tokens;
    try {
      tokens = await tokenRequest(refreshParams);
    } catch (error) {
      if (error instanceof BufferApiError && error.status === 401) throw error;
      throw error;
    }
    // Buffer refresh tokens are single-use. Never persist a rotated session without the new token.
    if (!tokens.refresh_token) {
      throw new BufferApiError("Buffer did not return a replacement refresh token. Reconnect your account before continuing.", 401, "reauthorization_required");
    }
    const rotated: BufferSession = {
      ...latest,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope ?? latest.scope,
      tokenType: tokens.token_type ?? latest.tokenType
    };
    await writeBufferSession(sid, rotated); // Persist replacement refresh token before the next operation.
    return rotated;
  })();
  g.__releasebuffRefreshLocks.set(sid, task);
  try { return await task; }
  finally { g.__releasebuffRefreshLocks.delete(sid); }
}

export async function bufferGraphQL<T>(sid: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const session = await getValidBufferSession(sid);
  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status === 401) throw new BufferApiError("Buffer rejected the session. Reconnect your Buffer account.", 401, "reauthorization_required");
  if (!response.ok) throw new BufferApiError(`Buffer API request failed (${response.status}). Try again later.`, 502, "api_error");
  const payload = await response.json() as { data?: T; errors?: { message?: string }[] };
  if (payload.errors?.length) {
    const message = payload.errors.map(e => e.message).filter(Boolean).join("; ");
    throw new BufferApiError(message || "Buffer rejected the request.", 422, "graphql_error");
  }
  if (!payload.data) throw new BufferApiError("Buffer returned an empty response.", 502, "empty_response");
  return payload.data;
}

export async function fetchBufferChannels(sid: string): Promise<BufferChannel[]> {
  const accountData = await bufferGraphQL<{ account: { organizations: { id: string; name: string }[] } }>(sid, `query GetOrganizations { account { organizations { id name } } }`);
  const orgs = accountData.account?.organizations ?? [];
  const nested = await Promise.all(orgs.map(async (organization) => {
    const response = await bufferGraphQL<{ channels: Omit<BufferChannel, "organizationName">[] }>(sid,
      `query GetChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName service avatar isDisconnected isLocked isQueuePaused organizationId timezone } }`,
      { organizationId: organization.id }
    );
    return (response.channels ?? []).map(channel => ({ ...channel, organizationName: organization.name }));
  }));
  return nested.flat();
}

export async function createBufferPost(sid: string, input: {
  text: string; channelId: string; action: "draft" | "publish" | "schedule";
  dueAt?: string; schedulingType: "automatic" | "notification";
}): Promise<BufferApiPostResult> {
  if (!input.text.trim()) throw new BufferApiError("Post text cannot be empty.", 400, "empty_text");
  const mode = input.action === "publish" ? "shareNow" : input.action === "schedule" ? "customScheduled" : "addToQueue";
  if (input.action === "schedule" && (!input.dueAt || !Number.isFinite(Date.parse(input.dueAt)) || Date.parse(input.dueAt) <= Date.now())) {
    throw new BufferApiError("Choose a valid future date and time.", 400, "invalid_due_at");
  }
  const query = `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id text dueAt status channelId } }
      ... on MutationError { message }
    }
  }`;
  const variables = { input: {
    text: input.text.trim(),
    channelId: input.channelId,
    schedulingType: input.schedulingType,
    mode,
    ...(input.action === "schedule" ? { dueAt: input.dueAt } : {}),
    ...(input.action === "draft" ? { saveToDraft: true } : {}),
    aiAssisted: true,
    source: "Releasebuff"
  } };
  const data = await bufferGraphQL<{ createPost: { post?: BufferApiPostResult; message?: string } }>(sid, query, variables);
  if (data.createPost?.message) throw new BufferApiError(data.createPost.message, 422, "post_rejected");
  if (!data.createPost?.post?.id) throw new BufferApiError("Buffer did not confirm the post action.", 502, "no_post_confirmation");
  return data.createPost.post;
}
