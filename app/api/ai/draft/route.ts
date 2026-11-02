import { NextResponse } from "next/server";
import { generateGroundedDraft } from "@/lib/ai";
import { allowRequest } from "@/lib/rate-limit";
import { errorStatus, jsonError, safeErrorMessage } from "@/lib/http";
import type { ProductMaterial, ProductProfile, StoryInterviewAnswer, StoryOpportunity, StoryWritingPreferences } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 5_500_000) return jsonError("Draft context is too large. Remove some materials or choose a smaller image/PDF.", 413, "payload_too_large");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(`draft:${ip}`, 20, 60_000)) return jsonError("Too many draft requests. Wait a minute and try again.", 429, "rate_limited");
  try {
    const body = await request.json() as {
      story?: StoryOpportunity; platform?: unknown; voice?: unknown; extraContext?: unknown;
      productProfile?: ProductProfile | null; productDescription?: unknown; productAudience?: unknown; productStage?: unknown;
      materials?: ProductMaterial[]; interviewAnswers?: StoryInterviewAnswer[]; interviewSummary?: unknown; writingPreferences?: StoryWritingPreferences;
    };
    if (!body.story || typeof body.story.title !== "string" || typeof body.story.summary !== "string" || !Array.isArray(body.story.evidence)) return jsonError("Select a story before generating a draft.");
    const platform = body.platform === "x" ? "x" : body.platform === "linkedin" ? "linkedin" : null;
    if (!platform) return jsonError("Choose LinkedIn or X as the draft platform.");
    if (body.extraContext !== undefined && (typeof body.extraContext !== "string" || body.extraContext.length > 20_000)) return jsonError("Additional context must be 20,000 characters or fewer.");
    const materials = Array.isArray(body.materials) ? body.materials.filter(m => m && typeof m.title === "string").slice(0, 20) : [];
    const result = await generateGroundedDraft({
      story: body.story, platform, voice: typeof body.voice === "string" ? body.voice.slice(0, 200) : "natural, specific, builder-to-builder",
      extraContext: typeof body.extraContext === "string" ? body.extraContext : "", productProfile: body.productProfile ?? null,
      productDescription: typeof body.productDescription === "string" ? body.productDescription.slice(0, 4000) : "",
      productAudience: typeof body.productAudience === "string" ? body.productAudience.slice(0, 1000) : "",
      productStage: typeof body.productStage === "string" ? body.productStage.slice(0, 100) : "",
      materials, interviewAnswers: Array.isArray(body.interviewAnswers) ? body.interviewAnswers.slice(0, 10) : [],
      interviewSummary: typeof body.interviewSummary === "string" ? body.interviewSummary.slice(0, 6000) : "", writingPreferences: body.writingPreferences
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(safeErrorMessage(error, "Could not generate a draft."), errorStatus(error, 502), "draft_generation_failed");
  }
}
