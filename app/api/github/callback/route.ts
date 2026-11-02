import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { constantTimeEqual } from "@/lib/buffer-api";
import { getAppBaseUrl } from "@/lib/http";
import { deleteGitHubUserAuthorization, oauthCookieOptions, readGitHubUserAuthorization, SESSION_COOKIE, writeGitHubInstallation } from "@/lib/session-store";
import { verifyInstallationAccessibleToUser } from "@/lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const home = new URL("/", getAppBaseUrl(request));
  home.searchParams.set("view", "setup");
  const state = url.searchParams.get("state") ?? "";
  const installId = Number(url.searchParams.get("installation_id"));
  const setupAction = url.searchParams.get("setup_action");
  const store = await cookies();
  const expected = store.get("releasebuff_github_state")?.value ?? "";
  const sid = store.get(SESSION_COOKIE)?.value ?? "";
  const fail = (notice: string) => {
    const target = new URL(home); target.searchParams.set("github", notice);
    const response = NextResponse.redirect(target);
    response.cookies.set("releasebuff_github_state", "", oauthCookieOptions(0));
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  if (!state || !expected || !constantTimeEqual(state, expected) || !/^[A-Za-z0-9_-]{32,100}$/.test(sid)) return fail("state-error");
  if (setupAction !== "install" && setupAction !== "update") return fail("not-installed");
  if (!Number.isSafeInteger(installId) || installId < 1) return fail("invalid-installation");
  try {
    const userAuthorization = await readGitHubUserAuthorization(sid);
    if (!userAuthorization) return fail("user-verification-expired");
    const canAccessInstallation = await verifyInstallationAccessibleToUser(userAuthorization.accessToken, installId);
    if (!canAccessInstallation) return fail("installation-not-authorized-for-user");
    await writeGitHubInstallation(sid, { installationId: installId, connectedAt: new Date().toISOString() });
    await deleteGitHubUserAuthorization(sid).catch(() => undefined);
    const target = new URL(home); target.searchParams.set("github", "connected");
    const response = NextResponse.redirect(target);
    response.cookies.set("releasebuff_github_state", "", oauthCookieOptions(0));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return fail("storage-error");
  }
}
