import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertSameOrigin, safeErrorMessage } from "@/lib/http";
import { deleteGitHubInstallation, deleteGitHubUserAuthorization, SESSION_COOKIE } from "@/lib/session-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return NextResponse.json({ error: safeErrorMessage(error) }, { status: 403 }); }
  const store = await cookies(); const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) { await deleteGitHubInstallation(sid).catch(() => undefined); await deleteGitHubUserAuthorization(sid).catch(() => undefined); }
  return NextResponse.json({ ok: true, connected: false }, { headers: { "Cache-Control": "no-store" } });
}
