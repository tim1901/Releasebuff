import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { discoverStories } from "@/lib/story-discovery";
import { TRELLIS_DEMO_STORIES } from "@/lib/demo-data";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-6.1-sol");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AI-assisted story discovery", () => {
  it("uses the configured model and returns AI-refined story opportunities on success", async () => {
    const candidate = TRELLIS_DEMO_STORIES[0];
    const evidenceId = candidate.evidence[0]?.id;
    expect(evidenceId).toBeTruthy();
    const story = {
      category: candidate.category,
      title: "A specific repository-backed story",
      summary: "A concise account of a documented change.",
      angle: "Explain the decision that shaped the change without claiming user impact.",
      whyItMatters: "The source provides a concrete implementation detail.",
      confidence: "medium",
      evidenceIds: [evidenceId]
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({ stories: [story] })
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverStories({ candidates: [candidate] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body.model).toBe("gpt-6.1-sol");
    expect(result.mode).toBe("ai-assisted");
    expect(result.stories[0].title).toBe("A specific repository-backed story");
    expect(result.warning).toBeUndefined();
  });

  it("labels rule-based fallback when the model request fails instead of silently presenting it as AI", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Model not found" }
    }), { status: 400, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverStories({ candidates: [TRELLIS_DEMO_STORIES[0]] });

    expect(result.mode).toBe("evidence-rules");
    expect(result.stories).toHaveLength(1);
    expect(result.warning).toContain("HTTP 400");
    expect(result.warning).toContain("gpt-6.1-sol");
    expect(result.warning).toContain("Rule-based suggestions are being shown instead");
  });

  it("labels the non-AI path when no API key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverStories({ candidates: [TRELLIS_DEMO_STORIES[0]] });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.mode).toBe("evidence-rules");
    expect(result.warning).toContain("not AI-refined");
  });
});
