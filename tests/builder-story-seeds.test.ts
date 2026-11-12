import { describe, expect, it } from "vitest";
import { buildBuilderStorySeeds } from "@/lib/builder-story-seeds";
import type { ProductMaterial, ProductProfile, ProjectPreferences } from "@/lib/types";

const settings: ProjectPreferences = {
  productName: "Launchpad",
  productSummary: "A tool that helps independent founders turn product work into useful public stories.",
  audience: "solo SaaS founders",
  productStage: "actively-building",
  websiteUrl: "",
  repositoryUrl: "",
  goals: ["Grow an audience", "Get feedback and early adopters"],
  writingVoice: "Natural and specific"
};

describe("builder-context story discovery", () => {
  it("provides story starting points without any GitHub repository", () => {
    const stories = buildBuilderStorySeeds(settings, null, []);
    expect(stories).toHaveLength(4);
    expect(stories.map(story => story.category)).toContain("Founder journey / personal reflection");
    expect(stories.every(story => story.status === "needs-context")).toBe(true);
    expect(stories.every(story => story.evidence.some(item => item.id === "builder-product-context"))).toBe(true);
  });

  it("uses the Product Intelligence Profile and supplied materials together", () => {
    const profile: ProductProfile = {
      productName: "Launchpad",
      oneLineDescription: "A founder storytelling workspace",
      problem: "Founders struggle to explain why product changes matter",
      targetAudience: "solo SaaS founders",
      valueProposition: "Turn work into grounded stories",
      productStage: "actively-building",
      capabilities: ["Adaptive story interview"],
      differentiators: ["Product-context memory"],
      facts: [{ id: "fact-1", field: "User insight", value: "Founders lack time to document decisions", status: "builder-provided", sourceIds: [] }],
      unknowns: ["Evidence of customer demand"],
      updatedAt: "2026-11-12T00:00:00.000Z",
      generatedBy: "ai"
    };
    const note: ProductMaterial = {
      id: "founder-note-1",
      kind: "note",
      title: "Why I started",
      textContent: "I kept losing track of the decisions behind the work.",
      addedAt: "2026-11-12T00:00:00.000Z",
      sourceStatus: "user-provided"
    };
    const stories = buildBuilderStorySeeds(settings, profile, [note]);
    expect(stories[0].summary).toContain(profile.oneLineDescription);
    expect(stories[0].sourceFacts).toContain("User insight: Founders lack time to document decisions");
    expect(stories[0].evidence.some(item => item.id === "material-founder-note-1")).toBe(true);
  });
});
