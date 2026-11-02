import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isGitHubAppConfigured } from "@/lib/github-app";
import { readGitHubInstallation, SESSION_COOKIE } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  let connected = false;
  if (sid) {
    try { connected = Boolean(await readGitHubInstallation(sid)); } catch { connected = false; }
  }
  return NextResponse.json({ configured: isGitHubAppConfigured(), connected }, { headers: { "Cache-Control": "no-store" } });
}
