import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND_KIT } from "@/lib/brand-kit";
import { buildGifExplainerSvg, createFallbackGifExplainer, parseGifExplainerPlan } from "@/lib/gif-explainer";
import type { StoryOpportunity } from "@/lib/types";

const story: StoryOpportunity = {
  id: "story-gif",
  category: "Technical decision / trade-off",
  group: "Learning and craft",
  title: "Keeping tokens on the server",
  summary: "The integration keeps provider tokens on the server rather than exposing them to the browser.",
  angle: "A security decision that shapes the integration.",
  confidence: "high",
  status: "needs-context",
  evidence: [{ id: "note-1", label: "Implementation note", url: "#note", type: "builder_note", excerpt: "Provider tokens stay server-side." }],
  sourceFacts: ["Provider tokens stay server-side.", "The browser receives only the connection status."],
  generatedAt: "2026-11-12T00:00:00.000Z"
};

describe("Claude-directed GIF explainer planning", () => {
  it("creates four contextual scenes without requiring an Anthropic API key", () => {
    const plan = createFallbackGifExplainer(story, "I wanted provider credentials to remain server-side.", "Releasebuff");
    expect(plan.scenes).toHaveLength(4);
    expect(plan.scenes[0].title).toContain(story.title);
    expect(plan.scenes.some(scene => scene.caption.includes("server"))).toBe(true);
  });

  it("validates scene structures and rejects incomplete storyboards", () => {
    const fallback = createFallbackGifExplainer(story, "", "Releasebuff");
    expect(parseGifExplainerPlan({ headline: "Bad plan", scenes: [{ title: "Only one", caption: "Not enough", visual: "flow" }] }, fallback)).toBe(fallback);
    const parsed = parseGifExplainerPlan({
      headline: "A safer integration",
      subhead: "How the credential boundary works",
      scenes: [
        { kicker: "THE CONTEXT", title: "Keep credentials private", caption: "The browser should not receive provider tokens.", visual: "problem", labels: ["Credentials", "Server"] },
        { kicker: "THE BOUNDARY", title: "Handle tokens server-side", caption: "The server owns the provider connection.", visual: "system", labels: ["Browser", "Server", "Provider"] },
        { kicker: "THE DETAIL", title: "Return only status", caption: "The browser receives connection status rather than a token.", visual: "evidence", labels: ["Connection status"] },
        { kicker: "TAKEAWAY", title: "Keep the trust boundary clear", caption: "Keep credentials on the server.", visual: "takeaway", labels: ["Server-side tokens"] }
      ]
    }, fallback);
    expect(parsed.scenes).toHaveLength(4);
    expect(parsed.scenes[1].visual).toBe("system");
  });

  it("renders escaped labels and scene progress into a branded SVG", () => {
    const scene = {
      kicker: "THE DETAIL",
      title: "A <secure> connection & flow",
      caption: "Tokens stay server-side.",
      visual: "system" as const,
      labels: ["Browser <client>", "API & server", "Provider"]
    };
    const svg = buildGifExplainerSvg({ kit: DEFAULT_BRAND_KIT, scene, sceneIndex: 1, sceneCount: 4, productName: "Releasebuff" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("A &lt;secure&gt; connection &amp;");
    expect(svg).toContain("flow</tspan>");
    expect(svg).toContain("Browser");
    expect(svg).toContain("&lt;client&gt;");
    expect(svg).toContain("EXPLAINER 02/04");
    expect(svg).toContain("#173D2D");
  });
});
