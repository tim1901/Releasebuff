import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteBufferSession, SESSION_COOKIE } from "@/lib/session-store";
import { assertSameOrigin, safeErrorMessage } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch (error) { return NextResponse.json({ error: safeErrorMessage(error) }, { status: 403 }); }
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) {
    try { await deleteBufferSession(sid); }
    catch { return NextResponse.json({ error: "Could not clear the stored Buffer session. Please try again.", code: "disconnect_failed" }, { status: 500 }); }
  }
  // SESSION_COOKIE is shared by the local GitHub and Buffer connection records.
  // Delete only Buffer credentials; clearing the shared session would also orphan GitHub.
  return NextResponse.json({ ok: true, connected: false }, { headers: { "Cache-Control": "no-store" } });
}
