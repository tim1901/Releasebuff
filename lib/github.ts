import type { GitHubAnalysis, GitHubRepository } from "@/lib/types";
import { buildStoryOpportunities } from "@/lib/story-engine";

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  merged_at: string | null;
  updated_at: string;
  created_at: string;
  user?: { login: string };
  labels?: { name: string }[];
  additions?: number;
  deletions?: number;
  changed_files?: number;
  changedFiles?: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>;
}
export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  closed_at: string | null;
  updated_at: string;
  created_at: string;
  pull_request?: { url: string };
  labels?: { name: string }[];
}
export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { date?: string | null; name?: string | null } };
}
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}
interface GitHubRepositoryApiResponse {
  name?: string;
  full_name?: string;
  html_url?: string;
  description?: unknown;
  default_branch?: string;
  language?: unknown;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  updated_at?: string;
  topics?: unknown;
}

interface GitHubReadmeApiResponse {
  content?: string;
  encoding?: string;
}

export interface GitHubScanData {
  repository: GitHubRepository;
  pulls: GitHubPullRequest[];
  issues: GitHubIssue[];
  commits: GitHubCommit[];
  releases: GitHubRelease[];
  scannedAt: string;
  rateLimit: { remaining: string | null; reset: string | null };
}

interface CacheEntry { expiresAt: number; data: GitHubScanData }
const scanCache = new Map<string, CacheEntry>();
const CACHE_MS = 5 * 60 * 1000;
const MAX_SOURCE_BODY = 8_000;

export function parseGitHubRepositoryUrl(input: string): { owner: string; repo: string; canonicalUrl: string } {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Enter a valid GitHub repository URL."); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.port || url.username || url.password) {
    throw new Error("Use an HTTPS repository URL from https://github.com. For private repositories, connect GitHub and grant access to that repository.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) throw new Error("Use a repository URL in the format https://github.com/owner/repository.");
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || repo === "." || repo === "..") {
    throw new Error("The repository URL has an invalid owner or repository name.");
  }
  return { owner, repo, canonicalUrl: `https://github.com/${owner}/${repo}` };
}

async function githubJson<T>(path: string, accessToken?: string): Promise<{ data: T; headers: Headers }> {
  const token = accessToken?.trim() || process.env.GITHUB_API_TOKEN?.trim();
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Releasebuff/0.2 (repository-analysis)",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store"
  });
  if (!response.ok) {
    let message = `GitHub returned ${response.status}.`;
    if (response.status === 404) message = "Repository not found or not accessible. If it is private, connect GitHub and ensure the app was granted access.";
    if (response.status === 403 || response.status === 429) message = "GitHub rate limit reached. Wait before scanning again, or retry later.";
    if (response.status === 451) message = "GitHub cannot provide this repository in the current context.";
    throw new Error(message);
  }
  return { data: await response.json() as T, headers: response.headers };
}

function safeDescription(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, 1000) : null;
}

export async function scanPublicRepository(input: string, options: { force?: boolean; token?: string } = {}): Promise<GitHubScanData> {
  const parsed = parseGitHubRepositoryUrl(input);
  const repoKey = `${parsed.owner}/${parsed.repo}`.toLowerCase();
  const key = `${options.token ? "authorized" : "public"}:${repoKey}`;
  const cached = scanCache.get(key);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.data;

  const base = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
  const [repoResult, readmeResult, pullsResult, issuesResult, commitsResult, releasesResult] = await Promise.allSettled([
    githubJson<GitHubRepositoryApiResponse>(base, options.token),
    githubJson<GitHubReadmeApiResponse>(`${base}/readme`, options.token),
    githubJson<GitHubPullRequest[]>(`${base}/pulls?state=all&sort=updated&direction=desc&per_page=20`, options.token),
    githubJson<GitHubIssue[]>(`${base}/issues?state=all&sort=updated&direction=desc&per_page=20`, options.token),
    githubJson<GitHubCommit[]>(`${base}/commits?per_page=20`, options.token),
    githubJson<GitHubRelease[]>(`${base}/releases?per_page=10`, options.token)
  ]);

  if (repoResult.status === "rejected") throw repoResult.reason instanceof Error ? repoResult.reason : new Error("Could not retrieve the GitHub repository.");
  const repo = repoResult.value.data;
  let readme: string | null = null;
  if (readmeResult.status === "fulfilled") {
    const content = readmeResult.value.data;
    if (content.content && content.encoding === "base64") readme = Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, MAX_SOURCE_BODY);
  }

  const warnings: string[] = [];
  const pullsBase = pullsResult.status === "fulfilled" ? pullsResult.value.data : [];
  // File names and change counts add technical evidence without uploading raw code diffs to the AI.
  // Fetch only a small sample to limit unauthenticated GitHub API use.
  const fileEvidenceResults = await Promise.allSettled(pullsBase.filter(pr => Boolean(pr.merged_at)).slice(0, 6).map(async pr => {
    const result = await githubJson<Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>>(`${base}/pulls/${pr.number}/files?per_page=20`, options.token);
    return { number: pr.number, files: result.data.slice(0, 20).map(file => ({ filename: String(file.filename ?? "").slice(0, 300), status: String(file.status ?? "modified"), additions: Number(file.additions ?? 0), deletions: Number(file.deletions ?? 0), changes: Number(file.changes ?? 0) })) };
  }));
  const filesByPull = new Map<number, GitHubPullRequest["changedFiles"]>();
  for (const result of fileEvidenceResults) if (result.status === "fulfilled") filesByPull.set(result.value.number, result.value.files);
  const pulls = pullsBase.map(pr => ({ ...pr, changedFiles: filesByPull.get(pr.number) }));
  const issuesRaw = issuesResult.status === "fulfilled" ? issuesResult.value.data : [];
  const issues = issuesRaw.filter((issue) => !issue.pull_request);
  const commits = commitsResult.status === "fulfilled" ? commitsResult.value.data : [];
  const releases = releasesResult.status === "fulfilled" ? releasesResult.value.data.filter((release) => !release.draft) : [];
  const optional = [
    [readmeResult, "README"], [pullsResult, "pull requests"], [issuesResult, "issues"], [commitsResult, "commits"], [releasesResult, "releases"]
  ] as const;
  if (fileEvidenceResults.some(result => result.status === "rejected")) warnings.push("Could not retrieve changed-file summaries for some pull requests; story evidence may be less detailed.");
  for (const [result, name] of optional) if (result.status === "rejected") warnings.push(`Could not retrieve ${name}; some story types may be missing.`);

  const repository: GitHubRepository = {
    owner: parsed.owner,
    name: repo.name ?? parsed.repo,
    fullName: repo.full_name ?? key,
    url: repo.html_url ?? parsed.canonicalUrl,
    description: safeDescription(repo.description),
    defaultBranch: repo.default_branch ?? "main",
    language: typeof repo.language === "string" ? repo.language : null,
    stars: Number(repo.stargazers_count ?? 0),
    forks: Number(repo.forks_count ?? 0),
    openIssues: Number(repo.open_issues_count ?? 0),
    updatedAt: String(repo.updated_at ?? ""),
    readme,
    topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 20).filter((t: unknown): t is string => typeof t === "string") : [],
    dataWarnings: warnings
  };

  const data: GitHubScanData = {
    repository, pulls, issues, commits, releases,
    scannedAt: new Date().toISOString(),
    rateLimit: {
      remaining: repoResult.value.headers.get("x-ratelimit-remaining"),
      reset: repoResult.value.headers.get("x-ratelimit-reset")
    }
  };
  scanCache.set(key, { expiresAt: Date.now() + CACHE_MS, data });
  return data;
}

export async function analyzePublicRepository(input: string, options: { force?: boolean; token?: string } = {}): Promise<GitHubAnalysis> {
  const data = await scanPublicRepository(input, options);
  return {
    repository: data.repository,
    stories: buildStoryOpportunities(data),
    scannedAt: data.scannedAt,
    scannedArtifacts: {
      commits: data.commits.length,
      pullRequests: data.pulls.length,
      issues: data.issues.length,
      releases: data.releases.length
    },
    rateLimit: data.rateLimit
  };
}
