import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSessionId, deleteGitHubUserAuthorization, oauthCookieOptions, SESSION_COOKIE } from "@/lib/session-store";
import { getAppBaseUrl } from "@/lib/http";
import { githubUserAuthorizationUrl, isGitHubAppConfigured } from "@/lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let base: URL;
  try { base = getAppBaseUrl(request); }
  catch { return NextResponse.json({ error: "Set APP_BASE_URL before starting GitHub authorization." }, { status: 503 }); }
  if (!isGitHubAppConfigured()) {
    const target = new URL("/", base); target.searchParams.set("notice", "github-config-missing"); target.searchParams.set("view", "setup");
    return NextResponse.redirect(target);
  }
  const store = await cookies();
  const existingSid = store.get(SESSION_COOKIE)?.value;
  const sid = existingSid && /^[A-Za-z0-9_-]{32,100}$/.test(existingSid) ? existingSid : createSessionId();
  await deleteGitHubUserAuthorization(sid).catch(() => undefined);
  const state = randomBytes(32).toString("base64url");
  let authUrl: string;
  try { authUrl = githubUserAuthorizationUrl(state); }
  catch { const target = new URL("/", base); target.searchParams.set("github", "config-error"); return NextResponse.redirect(target); }
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(SESSION_COOKIE, sid, { ...oauthCookieOptions(60 * 60 * 24 * 30), httpOnly: true });
  response.cookies.set("releasebuff_github_state", state, oauthCookieOptions(600));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
