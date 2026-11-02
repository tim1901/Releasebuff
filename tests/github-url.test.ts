import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryUrl } from "@/lib/github";

describe("parseGitHubRepositoryUrl", () => {
  it("accepts a standard public repository URL", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/bearstouch/trellis")).toEqual({
      owner: "bearstouch", repo: "trellis", canonicalUrl: "https://github.com/bearstouch/trellis"
    });
  });
  it("normalizes trailing slash and .git suffix", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/Owner/my_repo.git/")).toEqual({
      owner: "Owner", repo: "my_repo", canonicalUrl: "https://github.com/Owner/my_repo"
    });
  });
  it("rejects non-GitHub hosts and non-HTTPS schemes", () => {
    expect(() => parseGitHubRepositoryUrl("https://github.evil.example/a/b")).toThrow(/HTTPS repository/i);
    expect(() => parseGitHubRepositoryUrl("http://github.com/a/b")).toThrow(/HTTPS repository/i);
  });
  it("rejects paths that are not repository roots", () => {
    expect(() => parseGitHubRepositoryUrl("https://github.com/a/b/pull/22")).toThrow(/format/i);
  });
  it("rejects URLs containing credentials", () => {
    expect(() => parseGitHubRepositoryUrl("https://user:pass@github.com/a/b")).toThrow(/HTTPS repository/i);
  });
});
