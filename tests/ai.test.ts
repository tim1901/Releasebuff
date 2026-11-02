import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The AI module is server-only in Next.js; mock that marker for unit tests.
vi.mock("server-only", () => ({}));

import { generateGroundedDraft } from "@/lib/ai";
import { TRELLIS_DEMO_STORIES } from "@/lib/demo-data";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OpenAI Responses API draft generation", () => {
  it("uses a grounded template when no OpenAI key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedDraft({
      story: TRELLIS_DEMO_STORIES[0],
      platform: "linkedin",
      voice: "natural"
    });

    expect(result.mode).toBe("grounded-template");
    expect(result.draft).toContain(TRELLIS_DEMO_STORIES[0].title);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls OpenAI's Responses API server-side and extracts output text", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-6.1-terra");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "resp_test",
      output: [{ type: "message", content: [{ type: "output_text", text: "A grounded draft from OpenAI." }] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedDraft({
      story: TRELLIS_DEMO_STORIES[0],
      platform: "linkedin",
      voice: "natural, builder-to-builder",
      extraContext: "Keep the copy factual."
    });

    expect(result).toMatchObject({ draft: "A grounded draft from OpenAI.", mode: "ai", model: "gpt-6.1-terra" });
    expect(Array.isArray(result.reviewWarnings)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-openai-key");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe("gpt-6.1-terra");
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(1200);
    expect(String(body.instructions)).toContain("Never invent motivations");
  });

  it("returns a useful error if OpenAI rejects the API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "invalid-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Invalid API key" }
    }), { status: 401, headers: { "Content-Type": "application/json" } })));

    await expect(generateGroundedDraft({
      story: TRELLIS_DEMO_STORIES[0],
      platform: "linkedin",
      voice: "natural"
    })).rejects.toMatchObject({ status: 401, message: expect.stringContaining("OPENAI_API_KEY") });
  });
});
