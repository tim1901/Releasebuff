import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-store";
import { createBufferPost, fetchBufferChannels, BufferApiError } from "@/lib/buffer-api";
import { assertSameOrigin, errorStatus, safeErrorMessage } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch (error) { return NextResponse.json({ error: safeErrorMessage(error), code: "origin_mismatch" }, { status: 403 }); }
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ error: "Connect Buffer before sending a post.", code: "not_connected" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const body = await request.json() as { action?: unknown; channelId?: unknown; text?: unknown; dueAt?: unknown; schedulingType?: unknown };
    if (!(["draft", "publish", "schedule"] as unknown[]).includes(body.action)) return NextResponse.json({ error: "Choose save draft, publish now or schedule.", code: "invalid_action" }, { status: 400 });
    if (typeof body.channelId !== "string" || body.channelId.length > 200) return NextResponse.json({ error: "Choose a valid Buffer channel.", code: "invalid_channel" }, { status: 400 });
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 20_000) return NextResponse.json({ error: "Post content must be between 1 and 20,000 characters.", code: "invalid_text" }, { status: 400 });
    if (body.schedulingType !== undefined && !(["automatic", "notification"] as unknown[]).includes(body.schedulingType)) return NextResponse.json({ error: "Invalid publishing method.", code: "invalid_scheduling_type" }, { status: 400 });
    const channels = await fetchBufferChannels(sid);
    const channel = channels.find(c => c.id === body.channelId);
    if (!channel) return NextResponse.json({ error: "That channel is not available on your connected Buffer account. Refresh channels and try again.", code: "channel_not_found" }, { status: 403 });
    if (channel.isDisconnected || channel.isLocked) return NextResponse.json({ error: "This Buffer channel is disconnected or locked. Select another channel or reconnect it in Buffer.", code: "channel_unavailable" }, { status: 409 });
    if (body.action === "schedule" && channel.isQueuePaused && body.schedulingType !== "notification") return NextResponse.json({ error: "This channel's Buffer queue is paused. Resume its queue in Buffer or choose a notification-based schedule where supported.", code: "queue_paused" }, { status: 409 });
    if (body.action === "schedule" && typeof body.dueAt !== "string") return NextResponse.json({ error: "Choose a publication date and time.", code: "missing_due_at" }, { status: 400 });
    if ((body.action === "schedule" || body.action === "publish") && ["instagram", "tiktok", "pinterest", "youtube"].includes(channel.service.toLowerCase())) return NextResponse.json({ error: `This first version creates text-only posts. Buffer requires media or additional metadata for ${channel.service}; choose a text-capable channel for now.`, code: "channel_requires_media" }, { status: 422 });
    if (body.action === "schedule" && typeof body.dueAt === "string" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.dueAt)) return NextResponse.json({ error: "Scheduling time must be provided as an ISO 8601 UTC timestamp.", code: "invalid_due_at_format" }, { status: 400 });
    const post = await createBufferPost(sid, {
      action: body.action as "draft" | "publish" | "schedule",
      channelId: body.channelId,
      text: body.text,
      dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
      schedulingType: body.action === "schedule" ? ((body.schedulingType as "automatic" | "notification") || "automatic") : "automatic"
    });
    return NextResponse.json({ ok: true, action: body.action, post, channel: { id: channel.id, name: channel.name, service: channel.service } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error, "Buffer could not complete the post action."), code: error instanceof BufferApiError ? error.code : "buffer_post_failed" }, { status: errorStatus(error, 502), headers: { "Cache-Control": "no-store" } });
  }
}
