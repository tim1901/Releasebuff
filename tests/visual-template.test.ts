import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND_KIT } from "@/lib/brand-kit";
import { buildStoryVisualSvg } from "@/lib/visual-template";
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

describe("story visual template", () => {
  it("creates a branded SVG with escaped builder text", () => {
    const svg = buildStoryVisualSvg({ kit: DEFAULT_BRAND_KIT, story: { ...exampleStory, title: "A <safe> story & decision" }, productName: "Example product" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("A &lt;safe&gt; story &amp; decision");
    expect(svg).toContain("#173D2D");
  });
  it("encodes an animated GIF container from RGBA frames", () => {
    const frame = new Uint8ClampedArray([30, 40, 50, 255, 200, 220, 100, 255, 15, 20, 25, 255, 240, 245, 230, 255]);
    const gif = encodeAnimatedGif(2, 2, [frame, frame], 180);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[gif.length - 1]).toBe(0x3b);
    expect(gif.length).toBeGreaterThan(100);
  });
});
