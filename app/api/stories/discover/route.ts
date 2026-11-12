import { NextResponse } from "next/server";
import { discoverStories } from "@/lib/story-discovery";
import { assertSameOrigin, jsonError, safeErrorMessage } from "@/lib/http";
import { allowRequest } from "@/lib/rate-limit";
import { buildBuilderStorySeeds } from "@/lib/builder-story-seeds";
import { CATEGORY_GROUPS, categoryDefinition } from "@/lib/story-categories";
import type { ProductMaterial, ProductProfile, ProjectPreferences, StoryCategory, StoryOpportunity } from "@/lib/types";

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
      targetCategory?: StoryCategory;
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
    const targetCategory = body.targetCategory && CATEGORY_GROUPS.some(group => group.categories.some(category => category.name === body.targetCategory)) ? body.targetCategory : undefined;
    const categoryMatches = targetCategory ? [...profileCandidates, ...githubCandidates].filter(story => story.category === targetCategory) : [];
    const categoryInfo = targetCategory ? categoryDefinition(targetCategory) : undefined;
    const categorySeed: StoryOpportunity | undefined = targetCategory && !categoryMatches.length && profileCandidates[0] && categoryInfo ? {
      ...profileCandidates[0],
      id: `builder-${settings.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${targetCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      category: targetCategory,
      group: categoryInfo.group,
      title: `${categoryInfo.name}: ${settings.productName.trim() || "your product"}`,
      summary: categoryInfo.description,
      angle: categoryInfo.example,
      whyItMatters: `Explore this angle using the product profile and builder-provided context. ${categoryInfo.evidenceHint}`,
      status: "needs-context",
      confidence: "low",
      requiresContext: `For this ${categoryInfo.name.toLowerCase()} story, what specific experience, decision, event, or verified detail can you share?`,
      evidenceCoverage: "context-needed"
    } : undefined;
    const candidates = [...profileCandidates, ...githubCandidates, ...(categorySeed ? [categorySeed] : [])];
    const discovery = await discoverStories({
      candidates: targetCategory ? candidates.filter(story => story.category === targetCategory) : candidates,
      profile,
      productDescription: settings.productSummary,
      audience: settings.audience || profile?.targetAudience || "",
      materials: combinedMaterials
    });
    const discoveredStories = discovery.stories.length ? discovery.stories : (targetCategory ? [...categoryMatches, ...(categorySeed ? [categorySeed] : [])] : profileCandidates);
    const stories = (targetCategory ? discoveredStories.filter(story => story.category === targetCategory) : discoveredStories).slice(0, 12);
    return NextResponse.json({
      stories,
      mode: discovery.mode,
      warning: discovery.warning ?? null,
      githubUsed: githubCandidates.length > 0,
      targetCategory: targetCategory ?? null,
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
