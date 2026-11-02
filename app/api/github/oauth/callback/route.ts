import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { constantTimeEqual } from "@/lib/buffer-api";
import { exchangeGitHubUserCode } from "@/lib/github-app";
import { getAppBaseUrl } from "@/lib/http";
import { oauthCookieOptions, readGitHubUserAuthorization, SESSION_COOKIE, writeGitHubUserAuthorization } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let base: URL;
  try { base = getAppBaseUrl(request); }
  catch { return NextResponse.json({ error: "APP_BASE_URL is missing or invalid." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  const expectedState = cookieStore.get("releasebuff_github_state")?.value ?? "";
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const error = url.searchParams.get("error");
  const redirect = (notice: string) => {
    const target = new URL("/", base);
    target.searchParams.set("github", notice);
    target.searchParams.set("view", "setup");
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set("releasebuff_github_state", "", oauthCookieOptions(0));
    return response;
  };
  if (!sid || !/^[A-Za-z0-9_-]{32,100}$/.test(sid) || !state || !expectedState || !constantTimeEqual(state, expectedState)) return redirect("state-error");
  if (error) return redirect(error === "access_denied" ? "denied" : "authorization-error");
  if (!code) return redirect("callback-incomplete");
  try {
    const existing = await readGitHubUserAuthorization(sid);
    if (!existing) {
      const userToken = await exchangeGitHubUserCode(code);
      await writeGitHubUserAuthorization(sid, { accessToken: userToken, authorizedAt: new Date().toISOString() });
    }
    const slug = (process.env.GITHUB_APP_SLUG ?? "").trim();
    if (!slug) return redirect("config-error");
    // GitHub returns to the configured App Setup URL after installation; that
    // callback verifies that this user token can actually see the installation.
    const installUrl = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
    installUrl.searchParams.set("state", state);
    const response = NextResponse.redirect(installUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return redirect("oauth-failed");
  }
}
