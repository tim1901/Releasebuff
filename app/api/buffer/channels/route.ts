import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-store";
import { fetchBufferChannels, BufferApiError } from "@/lib/buffer-api";
import { errorStatus, safeErrorMessage } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ error: "Connect Buffer before loading channels.", code: "not_connected" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const channels = await fetchBufferChannels(sid);
    return NextResponse.json({ channels }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error), code: error instanceof BufferApiError ? error.code : "channels_failed" }, { status: errorStatus(error, 502), headers: { "Cache-Control": "no-store" } });
  }
}
