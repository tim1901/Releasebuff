import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { bufferAuthorizationUrl, createPkcePair, isBufferOAuthConfigured } from "@/lib/buffer-api";
import { oauthCookieOptions } from "@/lib/session-store";
import { getAppBaseUrl } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let home: URL;
  try { home = new URL("/", getAppBaseUrl(request)); }
  catch { return NextResponse.json({ error: "Set APP_BASE_URL to your local or deployed application origin before configuring Buffer OAuth." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  if (!isBufferOAuthConfigured()) {
    home.searchParams.set("notice", "buffer-config-missing");
    return NextResponse.redirect(home);
  }
  try {
    const state = randomBytes(32).toString("base64url");
    const { verifier, challenge } = createPkcePair();
    const response = NextResponse.redirect(bufferAuthorizationUrl(state, challenge));
    response.cookies.set("releasebuff_oauth_state", state, oauthCookieOptions(600));
    response.cookies.set("releasebuff_oauth_verifier", verifier, oauthCookieOptions(600));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    home.searchParams.set("notice", "buffer-config-missing");
    return NextResponse.redirect(home);
  }
}
