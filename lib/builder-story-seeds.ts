import { CATEGORY_GROUPS } from "@/lib/story-categories";
import type { ProductMaterial, ProductProfile, ProjectPreferences, StoryEvidence, StoryOpportunity } from "@/lib/types";

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
    excerpt: material.textContent?.replace(/\s+/g, " ").trim().slice(0, 280),
    type,
    sourceStatus: material.kind === "url" && material.sourceStatus === "fetched" ? "source-supported" : "builder-provided",
    collectedAt: material.collectedAt ?? material.addedAt
  };
}

/** Creates interview-ready story starting points from builder context even when no repo exists. */
export function buildBuilderStorySeeds(settings: ProjectPreferences, profile: ProductProfile | null, materials: ProductMaterial[] = []): StoryOpportunity[] {
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
  const intelligenceEvidence: StoryEvidence[] = [
    profileEvidence,
    ...(profile?.problem && !/^not yet established/i.test(profile.problem) ? [{
      id: "profile-problem", label: "Product Intelligence · Problem", type: "builder_note" as const,
      url: "#product-intelligence", excerpt: profile.problem.slice(0, 280), sourceStatus: "builder-provided" as const, collectedAt: updatedAt
    }] : []),
    ...(profile?.valueProposition && !/^not yet established/i.test(profile.valueProposition) ? [{
      id: "profile-value-proposition", label: "Product Intelligence · Value proposition", type: "builder_note" as const,
      url: "#product-intelligence", excerpt: profile.valueProposition.slice(0, 280), sourceStatus: "builder-provided" as const, collectedAt: updatedAt
    }] : []),
    ...(profile?.capabilities ?? []).slice(0, 3).map((capability, index) => ({
      id: `profile-capability-${index}`, label: `Product Intelligence · Capability ${index + 1}`, type: "builder_note" as const,
      url: "#product-intelligence", excerpt: String(capability).slice(0, 280),
      sourceStatus: "builder-provided" as const, collectedAt: updatedAt
    })),
    ...(profile?.facts ?? []).slice(0, 4).map((fact, index) => ({
      id: `profile-fact-${index}`, label: `Product Intelligence · ${fact.field}`, type: "builder_note" as const,
      url: "#product-intelligence", excerpt: fact.value.slice(0, 280), sourceStatus: "builder-provided" as const, collectedAt: updatedAt
    })),
    ...materials.slice(0, 5).map(materialEvidence)
  ];
  const evidence = intelligenceEvidence.slice(0, 6);
  const factLines = [
    description ? `Product description: ${description}` : "",
    profile?.problem && !/^not yet established/i.test(profile.problem) ? `Problem: ${profile.problem}` : "",
    audience ? `Intended audience: ${audience}` : "",
    profile?.valueProposition && !/^not yet established/i.test(profile.valueProposition) ? `Value proposition: ${profile.valueProposition}` : "",
    `Product stage: ${settings.productStage}`,
    settings.goals?.length ? `Builder goals: ${settings.goals.join(", ")}` : "",
    ...(profile?.facts ?? []).slice(0, 5).map(fact => `${fact.field}: ${fact.value}`)
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
    sourceFacts: [...new Set(factLines)].slice(0, 12),
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
