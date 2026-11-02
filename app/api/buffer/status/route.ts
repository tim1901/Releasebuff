import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-store";
import { getValidBufferSession, isBufferOAuthConfigured, BufferApiError, bufferGraphQL } from "@/lib/buffer-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ connected: false, configured: isBufferOAuthConfigured() }, { headers: { "Cache-Control": "no-store" } });
  try {
    const session = await getValidBufferSession(sid);
    const account = await bufferGraphQL<{ account: { id: string; email?: string } }>(sid, `query GetAccount { account { id email } }`);
    return NextResponse.json({ connected: true, configured: isBufferOAuthConfigured(), connectedAt: session.connectedAt, account: { id: account.account.id, email: account.account.email ?? null } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BufferApiError && error.status === 401) return NextResponse.json({ connected: false, configured: isBufferOAuthConfigured(), reconnectRequired: true }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ connected: false, configured: isBufferOAuthConfigured(), error: "Could not verify the Buffer session." }, { headers: { "Cache-Control": "no-store" } });
  }
}
