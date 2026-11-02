import { describe, expect, it } from "vitest";
import type { GitHubScanData } from "@/lib/github";
import { buildStoryOpportunities } from "@/lib/story-engine";

const emptyScan: GitHubScanData = {
  repository: {
    owner: "example", name: "empty", fullName: "example/empty", url: "https://github.com/example/empty",
    description: null, defaultBranch: "main", language: null, stars: 0, forks: 0, openIssues: 0,
    updatedAt: "", readme: null, readmePath: null, topics: [], dataWarnings: []
  },
  pulls: [], issues: [], commits: [], releases: [], scannedAt: "2026-11-02T00:00:00.000Z",
  rateLimit: { remaining: null, reset: null }
};

describe("evidence-first story discovery", () => {
  it("does not invent generic inbox prompts when there is no supporting material", () => {
    expect(buildStoryOpportunities(emptyScan)).toEqual([]);
  });

  it("attaches evidence to every discovered story", () => {
    const populated: GitHubScanData = {
      ...emptyScan,
      repository: { ...emptyScan.repository, description: "A terminal workspace tool", readme: "A native terminal workspace for managing windows and tabs." },
      pulls: [{
        number: 22, title: "feat: add searchable command palette", body: "Adds a searchable command palette for actions, windows, tabs, and panes.",
        html_url: "https://github.com/example/empty/pull/22", state: "closed", merged_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", created_at: "2026-10-31T00:00:00Z",
        changed_files: 3, additions: 100, deletions: 10, changedFiles: [{ filename: "src/CommandPalette.tsx", status: "added", additions: 80, deletions: 0, changes: 80 }]
      }]
    };
    const stories = buildStoryOpportunities(populated);
    expect(stories.length).toBeGreaterThan(0);
    expect(stories.every(story => story.evidence.length > 0)).toBe(true);
    expect(stories.flatMap(story => story.evidence).some(item => item.sourceStatus === "source-supported")).toBe(true);
  });
});
