import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  bufferAuthorizationUrl,
  exchangeAuthorizationCode,
  getValidBufferSession,
  isBufferOAuthConfigured
} from "@/lib/buffer-api";
import { createSessionId, deleteBufferSession, writeBufferSession } from "@/lib/session-store";

const createdSessionIds: string[] = [];

function tokenResponse(tokens: Record<string, unknown>) {
  return new Response(JSON.stringify(tokens), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function requestBody(mock: ReturnType<typeof vi.fn>) {
  const init = mock.mock.calls[0]?.[1] as RequestInit | undefined;
  return new URLSearchParams(String(init?.body ?? ""));
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  vi.stubEnv("SESSION_ENCRYPTION_KEY", "releasebuff-test-encryption-secret-at-least-32-chars");
  vi.stubEnv("BUFFER_CLIENT_ID", "test-buffer-client");
  vi.stubEnv("BUFFER_REDIRECT_URI", "http://localhost:3000/api/buffer/callback");
  delete process.env.BUFFER_CLIENT_SECRET;
});

afterEach(async () => {
  await Promise.all(createdSessionIds.splice(0).map((sid) => deleteBufferSession(sid).catch(() => undefined)));
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Buffer public OAuth client support", () => {
  it("accepts a public client without a client secret when other OAuth settings are ready", () => {
    expect(isBufferOAuthConfigured()).toBe(true);
  });

  it("builds a PKCE authorization URL without exposing a client secret", () => {
    const url = new URL(bufferAuthorizationUrl("test-state", "test-challenge"));
    expect(url.origin + url.pathname).toBe("https://auth.buffer.com/auth");
    expect(url.searchParams.get("client_id")).toBe("test-buffer-client");
    expect(url.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });

  it("exchanges an authorization code without client_secret for a public client", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      tokenResponse({ access_token: "access-public", refresh_token: "refresh-public", expires_in: 3600 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await exchangeAuthorizationCode("test-code", "test-verifier");
    const body = requestBody(fetchMock);

    expect(session.accessToken).toBe("access-public");
    expect(session.refreshToken).toBe("refresh-public");
    expect(body.get("client_id")).toBe("test-buffer-client");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("test-verifier");
    expect(body.has("client_secret")).toBe(false);
  });

  it("continues to include client_secret when a confidential client is explicitly configured", async () => {
    vi.stubEnv("BUFFER_CLIENT_SECRET", "test-confidential-secret");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      tokenResponse({ access_token: "access-confidential", expires_in: 3600 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await exchangeAuthorizationCode("test-code", "test-verifier");
    expect(requestBody(fetchMock).get("client_secret")).toBe("test-confidential-secret");
  });

  it("refreshes a public client's session without sending client_secret", async () => {
    const sid = createSessionId();
    createdSessionIds.push(sid);
    await writeBufferSession(sid, {
      accessToken: "expired-access",
      refreshToken: "old-refresh",
      expiresAt: Date.now() - 1000,
      connectedAt: new Date().toISOString()
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      tokenResponse({ access_token: "access-refreshed", refresh_token: "refresh-rotated", expires_in: 3600 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await getValidBufferSession(sid);
    const body = requestBody(fetchMock);

    expect(session.accessToken).toBe("access-refreshed");
    expect(session.refreshToken).toBe("refresh-rotated");
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
    expect(body.has("client_secret")).toBe(false);
  });
});
