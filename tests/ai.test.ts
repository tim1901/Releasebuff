import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The AI module is server-only in Next.js; mock that marker for unit tests.
vi.mock("server-only", () => ({}));

import { configuredAiModel, generateGroundedDraft } from "@/lib/ai";
import { buildBuilderStorySeeds } from "@/lib/builder-story-seeds";
import type { ProjectPreferences } from "@/lib/types";

const testSettings: ProjectPreferences = {
  productName: "Launchpad",
  productSummary: "A tool that helps independent founders turn product work into useful public stories.",
  audience: "solo SaaS founders",
  productStage: "actively-building",
  websiteUrl: "",
  repositoryUrl: "",
  goals: ["Grow an audience"],
  writingVoice: "Natural and specific"
};
const testStory = buildBuilderStorySeeds(testSettings, null, [])[0];

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
  it("defaults to the supported GPT-6.1 Sol model when OPENAI_MODEL is unset", () => {
    expect(configuredAiModel()).toBe("gpt-6.1-sol");
  });


  it("uses a grounded template when no OpenAI key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedDraft({
      story: testStory,
      platform: "linkedin",
      voice: "natural"
    });

    expect(result.mode).toBe("grounded-template");
    expect(result.draft).toContain(testStory.title);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls OpenAI's Responses API server-side and extracts output text", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-6.1-sol");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "resp_test",
      output: [{ type: "message", content: [{ type: "output_text", text: "A grounded draft from OpenAI." }] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedDraft({
      story: testStory,
      platform: "linkedin",
      voice: "natural, builder-to-builder",
      extraContext: "Keep the copy factual."
    });

    expect(result).toMatchObject({ draft: "A grounded draft from OpenAI.", mode: "ai", model: "gpt-6.1-sol" });
    expect(Array.isArray(result.reviewWarnings)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-openai-key");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe("gpt-6.1-sol");
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(450);
    expect(String(body.instructions)).toContain("Never invent motivation");
    expect(String(body.instructions)).toContain("Target 70–120 words");
    expect(String(body.instructions)).toContain("Every sentence must add a detail, decision, insight or necessary context.");
  });


  it("sets a strict short-post contract for X", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: "One concrete point, in a short post."
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGroundedDraft({
      story: testStory,
      platform: "x",
      voice: "direct and concise"
    });

    expect(result.mode).toBe("ai");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.max_output_tokens).toBe(160);
    expect(String(body.instructions)).toContain("never exceed 260 characters");
    expect(String(body.instructions)).toContain("ONE standalone post, not a thread");
  });

  it("returns a useful error if OpenAI rejects the API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "invalid-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Invalid API key" }
    }), { status: 401, headers: { "Content-Type": "application/json" } })));

    await expect(generateGroundedDraft({
      story: testStory,
      platform: "linkedin",
      voice: "natural"
    })).rejects.toMatchObject({ status: 401, message: expect.stringContaining("OPENAI_API_KEY") });
  });
});
