import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { assertSameOrigin, jsonError, safeErrorMessage } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return jsonError(safeErrorMessage(error), 403, "forbidden_origin"); }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest("graphic-image:" + ip, 4, 60_000)) {
    return NextResponse.json({ error: "Too many image generations. Wait a minute before trying again." }, { status: 429 });
  }
  let body: { prompt?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "The image-generation request must be valid JSON." }, { status: 400 }); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 12000) : "";
  if (prompt.length < 80) return NextResponse.json({ error: "Create or enter a complete image prompt before generating the graphic." }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Image generation is not configured. Add OPENAI_API_KEY to the deployment environment." }, { status: 503 });
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2",
        prompt: prompt + "\nFinal output: one finished square 1:1 image, intended to be exported at 1080 x 1080 pixels. No extra variants.",
        size: "1024x1024",
        quality: "high",
        n: 1,
        output_format: "png"
      }),
      signal: AbortSignal.timeout(110_000),
      cache: "no-store"
    });
    const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string; type?: string } };
    if (!response.ok) {
      const message = payload.error?.message || "The image model could not render this graphic.";
      return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : response.status === 401 ? 503 : 502 });
    }
    const image = payload.data?.[0];
    if (image?.b64_json) return NextResponse.json({ imageDataUrl: "data:image/png;base64," + image.b64_json, sourceSize: 1024, outputSize: 1080 }, { headers: { "Cache-Control": "no-store" } });
    if (image?.url) return NextResponse.json({ imageUrl: image.url, sourceSize: 1024, outputSize: 1080 }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "The image provider returned no image. Nothing was substituted; please retry." }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Image generation timed out or could not be reached. Your prompt is preserved so you can retry." }, { status: 502 });
  }
}
