import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND_KIT } from "@/lib/brand-kit";
import { buildStoryVisualSvg, createContextualVisualPlan, extractMetricDetails } from "@/lib/visual-template";
import { encodeAnimatedGif } from "@/lib/gif-encoder";
import type { StoryOpportunity } from "@/lib/types";

const exampleStory: StoryOpportunity = {
  id: "story-test",
  category: "Technical decision / trade-off",
  group: "Learning and craft",
  title: "Choosing a smaller, safer integration",
  summary: "The implementation keeps provider tokens on the server and tests the publishing journey end to end.",
  angle: "A grounded implementation decision",
  confidence: "medium",
  status: "needs-context",
  evidence: [{ id: "e1", label: "Test note", url: "#note", type: "builder_note", excerpt: "Tokens stay server-side." }],
  sourceFacts: ["Tokens stay server-side."],
  generatedAt: "2026-11-09T00:00:00.000Z"
};

describe("story visual planning and template", () => {
  it("creates a branded, story-specific SVG with escaped text and a product-name signature", () => {
    const svg = buildStoryVisualSvg({ kit: DEFAULT_BRAND_KIT, story: { ...exampleStory, title: "A <safe> story & decision" }, productName: "Example product" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("A &lt;safe&gt; story &amp; decision");
    expect(svg).toContain("Example product");
    expect(svg).toContain("#173D2D");
    expect(svg).not.toContain("<image ");
    expect(svg).not.toContain("brand-mark");
  });

  it("chooses a release-led headline instead of a raw package version", () => {
    const story = { ...exampleStory, category: "New feature shipped" as const, title: "astro@7.4.4-beta.0", summary: "A published release is available." };
    const plan = createContextualVisualPlan({ story, productName: "Releasebuff" });
    expect(plan.layout).toBe("release");
    expect(plan.headline).not.toBe("astro@7.4.4-beta.0");
    expect(plan.headline).toMatch(/release/i);
  });

  it("uses a metric composition only when a supported fact contains a measurable value", () => {
    const story = { ...exampleStory, category: "Traction and milestones" as const, sourceFacts: ["547 commits in my code history."] };
    const plan = createContextualVisualPlan({ story, productName: "Example" });
    expect(plan.layout).toBe("metric");
    expect(extractMetricDetails(story.sourceFacts[0])?.value).toBe("547");
    const svg = buildStoryVisualSvg({ kit: DEFAULT_BRAND_KIT, story, productName: "Example" });
    expect(svg).toContain(">547<");
    expect(svg).toContain("commits");
  });

  it("does not invent a metric layout when no source fact contains a measurable value", () => {
    const story = { ...exampleStory, category: "Traction and milestones" as const, sourceFacts: ["Tokens stay server-side."] };
    const plan = createContextualVisualPlan({ story, productName: "Example" });
    expect(plan.layout).not.toBe("metric");
    expect(plan.metricFactIndex).toBeNull();
  });

  it("wraps long headlines and breaks unbroken tokens inside the square canvas", () => {
    const svg = buildStoryVisualSvg({
      kit: DEFAULT_BRAND_KIT,
      productName: "Releasebuff",
      headlineOverride: "A".repeat(100),
      supportingLineOverride: "A very long supporting sentence that should wrap safely within the square canvas."
    });
    const heading = svg.match(/<text x="70" y="194"[\\s\\S]*?<\\/text>/)?.[0] ?? "";
    expect(heading).toContain("…");
    const titleLines = [...heading.matchAll(/<tspan[^>]*>(.*?)<\\/tspan>/g)].map(match => match[1]);
    expect(titleLines.length).toBeGreaterThan(1);
    expect(titleLines.length).toBeLessThanOrEqual(3);
    expect(titleLines.every(line => line.length <= 23)).toBe(true);
  });

  it("encodes an animated GIF container from RGBA frames", () => {
    const frame = new Uint8ClampedArray([30, 40, 50, 255, 200, 220, 100, 255, 15, 20, 25, 255, 240, 245, 230, 255]);
    const gif = encodeAnimatedGif(2, 2, [frame, frame], 180);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[gif.length - 1]).toBe(0x3b);
    expect(gif.length).toBeGreaterThan(100);
  });
});
