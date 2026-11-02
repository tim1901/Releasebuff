import { NextResponse } from "next/server";
import { constantTimeEqual, exchangeAuthorizationCode } from "@/lib/buffer-api";
import { createSessionId, oauthCookieOptions, SESSION_COOKIE, writeBufferSession } from "@/lib/session-store";
import { getAppBaseUrl } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let appBase: URL;
  try { appBase = getAppBaseUrl(request); }
  catch { return NextResponse.json({ error: "APP_BASE_URL is missing or invalid. Configure it and restart the server." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const redirectHome = (notice: string) => {
    const target = new URL("/", appBase);
    target.searchParams.set("buffer", notice);
    const response = NextResponse.redirect(target);
    response.cookies.set("releasebuff_oauth_state", "", oauthCookieOptions(0));
    response.cookies.set("releasebuff_oauth_verifier", "", oauthCookieOptions(0));
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const error = url.searchParams.get("error");
  // Parse Cookie header manually to avoid depending on a request adapter.
  const cookieMap = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const trimmed = part.trim();
    const at = trimmed.indexOf("=");
    if (at <= 0) continue;
    try { cookieMap.set(trimmed.slice(0, at), decodeURIComponent(trimmed.slice(at + 1))); }
    catch { /* Ignore malformed cookie values; state verification will fail closed. */ }
  }
  const expectedState = cookieMap.get("releasebuff_oauth_state") ?? "";
  const verifier = cookieMap.get("releasebuff_oauth_verifier") ?? "";
  if (!state || !expectedState || !constantTimeEqual(state, expectedState)) return redirectHome("state-error");
  if (error) return redirectHome(error === "access_denied" ? "denied" : "authorization-error");
  if (!code || !verifier) return redirectHome("callback-incomplete");

  try {
    const tokens = await exchangeAuthorizationCode(code, verifier);
    const priorSid = cookieMap.get(SESSION_COOKIE) ?? "";
    const sid = /^[A-Za-z0-9_-]{32,100}$/.test(priorSid) ? priorSid : createSessionId();
    await writeBufferSession(sid, tokens);
    const target = new URL("/", appBase);
    target.searchParams.set("buffer", "connected");
    const response = NextResponse.redirect(target);
    response.cookies.set(SESSION_COOKIE, sid, { ...oauthCookieOptions(60 * 60 * 24 * 30), httpOnly: true });
    response.cookies.set("releasebuff_oauth_state", "", oauthCookieOptions(0));
    response.cookies.set("releasebuff_oauth_verifier", "", oauthCookieOptions(0));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return redirectHome("token-exchange-error");
  }
}
