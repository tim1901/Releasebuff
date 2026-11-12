import { NextResponse } from "next/server";
import { discoverStories } from "@/lib/story-discovery";
import { assertSameOrigin, jsonError, safeErrorMessage } from "@/lib/http";
import { allowRequest } from "@/lib/rate-limit";
import { buildBuilderStorySeeds } from "@/lib/builder-story-seeds";
import type { ProductMaterial, ProductProfile, ProjectPreferences, StoryOpportunity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return jsonError(safeErrorMessage(error), 403, "forbidden_origin"); }
  if (Number(request.headers.get("content-length") ?? 0) > 5_500_000) return jsonError("The request is too large. Reduce the number of source materials or upload a smaller file.", 413, "payload_too_large");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(`story-discovery:${ip}`, 12, 60_000)) return jsonError("Too many story discovery requests. Wait a minute and try again.", 429, "rate_limited");
  try {
    const body = await request.json() as {
      settings?: ProjectPreferences;
      profile?: ProductProfile | null;
      materials?: ProductMaterial[];
      githubStories?: StoryOpportunity[];
    };
    const settings = body.settings;
    if (!settings || typeof settings.productName !== "string" || typeof settings.productSummary !== "string") return jsonError("Add a product name and a short product description first.", 400, "product_context_required");
    const materials = Array.isArray(body.materials) ? body.materials.filter(item => item && typeof item.title === "string").slice(0, 18) : [];
    const profile = body.profile ?? null;
    if (!settings.productName.trim() && !settings.productSummary.trim() && !profile && !materials.length) return jsonError("Add some product context before finding stories.", 400, "product_context_required");

    const now = new Date().toISOString();
    const profileMaterial: ProductMaterial = {
      id: "product-intelligence-profile",
      kind: "note",
      title: "Product Intelligence Profile",
      textContent: JSON.stringify(profile ? {
        productName: profile.productName, oneLineDescription: profile.oneLineDescription, problem: profile.problem,
        targetAudience: profile.targetAudience, valueProposition: profile.valueProposition, productStage: profile.productStage,
        capabilities: profile.capabilities, differentiators: profile.differentiators,
        facts: profile.facts, unknowns: profile.unknowns
      } : { note: "Profile has not been generated yet; use the current product settings and ask the builder to fill important gaps." }).slice(0, 9000),
      addedAt: now, sourceStatus: "user-provided"
    };
    const builderBrief: ProductMaterial = {
      id: "current-builder-brief",
      kind: "note",
      title: "Current product details and goals",
      textContent: JSON.stringify({
        productName: settings.productName, description: settings.productSummary, audience: settings.audience,
        stage: settings.productStage, goals: settings.goals, writingVoice: settings.writingVoice,
        website: settings.websiteUrl
      }).slice(0, 5000),
      addedAt: now, sourceStatus: "user-provided"
    };
    const combinedMaterials = [profileMaterial, builderBrief, ...materials].slice(0, 20);
    const profileCandidates = buildBuilderStorySeeds(settings, profile, materials);
    const githubCandidates = Array.isArray(body.githubStories) ? body.githubStories.filter(story => story && typeof story.title === "string" && Array.isArray(story.evidence)).slice(0, 20) : [];
    const candidates = [...profileCandidates, ...githubCandidates];
    const discovery = await discoverStories({
      candidates,
      profile,
      productDescription: settings.productSummary,
      audience: settings.audience || profile?.targetAudience || "",
      materials: combinedMaterials
    });
    const stories = (discovery.stories.length ? discovery.stories : profileCandidates).slice(0, 12);
    return NextResponse.json({
      stories,
      mode: discovery.mode,
      warning: discovery.warning ?? null,
      githubUsed: githubCandidates.length > 0,
      contextSources: {
        productProfile: Boolean(profile),
        builderMaterials: materials.length,
        githubStories: githubCandidates.length
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(safeErrorMessage(error, "Could not find stories from the available product context."), 502, "story_discovery_failed");
  }
}
