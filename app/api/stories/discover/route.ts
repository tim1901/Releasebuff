import { NextResponse } from "next/server";
import { discoverStories } from "@/lib/story-discovery";
import { assertSameOrigin, jsonError, safeErrorMessage } from "@/lib/http";
import { allowRequest } from "@/lib/rate-limit";
import { CATEGORY_GROUPS } from "@/lib/story-categories";
import type { ProductMaterial, ProductProfile, ProjectPreferences, StoryEvidence, StoryOpportunity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function groupFor(category: StoryOpportunity["category"]) {
  return CATEGORY_GROUPS.find(group => group.categories.some(item => item.name === category))?.name ?? "Product progress";
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "product";
}
function materialEvidence(material: ProductMaterial): StoryEvidence {
  const type: StoryEvidence["type"] = material.kind === "url" ? "website" : material.kind === "screenshot" ? "screenshot" : material.kind === "note" ? "builder_note" : "document";
  return {
    id: `material-${material.id}`,
    label: material.title || "Builder material",
    url: material.sourceUrl || `#material-${encodeURIComponent(material.id)}`,
    type,
    excerpt: material.textContent?.replace(/\s+/g, " ").trim().slice(0, 280),
    sourceStatus: material.kind === "url" && material.sourceStatus === "fetched" ? "source-supported" : "builder-provided",
    collectedAt: material.collectedAt ?? material.addedAt
  };
}
function seedStories(settings: ProjectPreferences, profile: ProductProfile | null, materials: ProductMaterial[]): StoryOpportunity[] {
  const name = profile?.productName || settings.productName.trim() || "this product";
  const description = profile?.oneLineDescription || settings.productSummary.trim();
  const audience = profile?.targetAudience || settings.audience.trim();
  const updatedAt = new Date().toISOString();
  const profileEvidence: StoryEvidence = {
    id: "builder-product-context",
    label: "Builder-provided product context",
    type: "builder_note",
    url: "#product-intelligence",
    excerpt: [description, audience ? `Intended audience: ${audience}` : ""].filter(Boolean).join(" ").slice(0, 280),
    sourceStatus: "builder-provided",
    collectedAt: updatedAt
  };
  const materialEvidenceList = materials.slice(0, 5).map(materialEvidence);
  const evidence = [profileEvidence, ...materialEvidenceList].slice(0, 6);
  const factLines = [
    description ? `Product description: ${description}` : "",
    audience ? `Intended audience: ${audience}` : "",
    `Product stage: ${settings.productStage}`,
    settings.goals?.length ? `Builder goals: ${settings.goals.join(", ")}` : ""
  ].filter(Boolean);
  const create = (category: StoryOpportunity["category"], suffix: string, title: string, summary: string, angle: string, question: string): StoryOpportunity => ({
    id: `builder-${slug(name)}-${suffix}`,
    category,
    group: groupFor(category),
    title,
    summary,
    angle,
    whyItMatters: "This is a starting point based on the builder's product context. The interview should uncover the personal experience behind it.",
    confidence: "low",
    status: "needs-context",
    evidence,
    sourceFacts: factLines,
    requiresContext: question,
    evidenceCoverage: "context-needed",
    generatedAt: updatedAt
  });
  return [
    create("Problem and solution", "problem", `The problem behind ${name}`, description ? `The current product brief describes ${description}` : `Explore the problem that ${name} is intended to address.`, "Find the real-world moment, frustration or observation that made this problem worth solving. Do not treat the product description as proof of customer demand.", "What happened or what did you observe that made you decide this problem was worth solving?"),
    create("Founder journey / personal reflection", "founder", `Why I'm building ${name}`, `Explore the experience and motivation behind building ${name}.`, "Tell the origin story using the builder's actual experience, not a generic founder narrative.", "What first led you to start building this, and why did it matter to you?"),
    create("Product showcase / demo", "product", `What ${name} is designed to help people do`, description || `Explain the product's intended purpose and how someone might use it.`, "Turn the product explanation into a concrete walkthrough. Verify what's available now and what is still planned.", "Can you walk me through a real example of someone using or benefiting from this product—or, if it's still an idea, how you imagine it would work?"),
    create("Ask the audience", "audience", `A question I'm exploring about ${name}`, audience ? `The product is intended for ${audience}. Identify a genuine open question where their perspective could help.` : "Identify a genuine product question where feedback from other builders or potential users could help.", "Make the ask specific and useful. Never invent audience feedback or imply that research has already happened.", "What decision or unanswered question would you genuinely like feedback on right now?")
  ];
}

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
    const profileCandidates = seedStories(settings, profile, materials);
    const githubCandidates = Array.isArray(body.githubStories) ? body.githubStories.filter(story => story && typeof story.title === "string" && Array.isArray(story.evidence)).slice(0, 20) : [];
    const candidates = [...githubCandidates, ...profileCandidates];
    const discovery = await discoverStories({
      candidates,
      profile,
      productDescription: settings.productSummary,
      audience: settings.audience || profile?.targetAudience || "",
      materials: combinedMaterials
    });
    const stories = discovery.stories.length ? discovery.stories : profileCandidates;
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
