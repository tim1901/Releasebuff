import type { GitHubScanData, GitHubPullRequest, GitHubIssue, GitHubCommit, GitHubRelease } from "@/lib/github";
import type { StoryEvidence, StoryOpportunity, StoryCategory, StoryGroup } from "@/lib/types";

function evidence(type: StoryEvidence["type"], id: string, label: string, url: string, excerpt?: string): StoryEvidence {
  return { id, label, type, url, excerpt: excerpt?.replace(/\s+/g, " ").slice(0, 280), sourceStatus: "source-supported" };
}
function groupFor(category: StoryCategory): StoryGroup {
  if (["New feature shipped", "Product improvement", "Bug fixed / problem solved", "Weekly build recap"].includes(category)) return "Product progress";
  if (["Technical decision / trade-off", "Lesson learned", "Failed experiment / changed direction", "Behind the scenes"].includes(category)) return "Learning and craft";
  if (["Product showcase / demo", "Problem and solution", "Product hype / launch promotion", "What's next / roadmap"].includes(category)) return "Product marketing";
  return "Audience and growth";
}
function makeStory(input: Omit<StoryOpportunity, "id" | "generatedAt" | "group"> & { id?: string }, generatedAt: string): StoryOpportunity {
  return {
    ...input,
    id: input.id ?? `${input.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${input.evidence.map(e => e.id).join("-")}`,
    group: groupFor(input.category),
    generatedAt
  };
}
const isFeature = (text: string) => /\b(feat|feature|add|introduc|implement|support|command palette|scratchpad|launch|release|create)\b/i.test(text);
const isFix = (text: string) => /\b(fix|bug|prevent|preserv|restore|crash|lose|lost|incorrect|regression|handle|failure|broken|close.*window)\b/i.test(text);
const isImprovement = (text: string) => /\b(improv|refin|accessibility|keyboard|focus|performance|optimi[sz]|polish|usability|rework|update|hardening)\b/i.test(text);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const bodyExcerpt = (s: string | null | undefined, max = 320) => clean(s).slice(0, max);
function prText(pr: GitHubPullRequest) { return `${pr.title} ${pr.body ?? ""}`; }
function commitText(commit: GitHubCommit) { return commit.commit.message ?? ""; }
function releaseText(release: GitHubRelease) { return `${release.name ?? ""} ${release.tag_name} ${release.body ?? ""}`; }
function prIsRepresentedInRelease(pr: GitHubPullRequest, release: GitHubRelease): boolean {
  const releaseContent = releaseText(release).toLowerCase();
  if (releaseContent.includes(`#${pr.number}`)) return true;
  const title = pr.title.replace(/^(feat|feature|fix|bug|chore|docs|refactor|perf)(\([^)]*\))?:\s*/i, "").toLowerCase();
  if (title.length > 10 && releaseContent.includes(title)) return true;
  const stopWords = new Set(["with", "from", "into", "then", "this", "that", "when", "what", "make", "made", "adds", "added", "update", "updates", "release", "support", "feat", "feature", "fix", "ui", "app"]);
  const tokens = title.match(/[a-z0-9]{3,}/g)?.filter(token => !stopWords.has(token)) ?? [];
  if (tokens.length < 2) return false;
  const matches = tokens.filter(token => releaseContent.includes(token));
  return matches.length >= 2 && matches.length / tokens.length >= 0.5;
}
function evidenceFromPr(pr: GitHubPullRequest) {
  const changed = (pr.changedFiles ?? []).slice(0, 8).map(file => `${file.filename} (${file.status}, +${file.additions}/-${file.deletions})`);
  const excerpt = [pr.body ?? "", changed.length ? `Changed files: ${changed.join("; ")}` : (pr.changed_files ? `Files changed: ${pr.changed_files}; additions: ${pr.additions ?? "unknown"}; deletions: ${pr.deletions ?? "unknown"}` : "")].filter(Boolean).join(" | ");
  return evidence("pull_request", `pr-${pr.number}`, `PR #${pr.number} · ${pr.title}`, `${pr.html_url}/files`, excerpt || undefined);
}
function evidenceFromIssue(issue: GitHubIssue) { return evidence("issue", `issue-${issue.number}`, `Issue #${issue.number} · ${issue.title}`, issue.html_url, issue.body ?? undefined); }
function evidenceFromCommit(commit: GitHubCommit) { return evidence("commit", commit.sha.slice(0, 7), `Commit ${commit.sha.slice(0, 7)} · ${commit.commit.message.split("\n")[0]}`, commit.html_url, commit.commit.message); }
function evidenceFromRelease(release: GitHubRelease) { return evidence("release", `release-${release.id}`, `${release.tag_name} · ${release.name ?? "Release"}`, release.html_url, release.body ?? undefined); }

export function buildStoryOpportunities(data: GitHubScanData): StoryOpportunity[] {
  const { repository, pulls, issues, commits, releases, scannedAt } = data;
  const stories: StoryOpportunity[] = [];
  const seen = new Set<string>();
  const add = (story: StoryOpportunity) => {
    const uniqueEvidence = story.evidence.map(e => e.id).join("|");
    const dedupeKey = `${story.category}:${uniqueEvidence}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    stories.push(story);
  };
  const mergedPulls = pulls.filter(p => Boolean(p.merged_at));
  const publishedReleases = releases.filter(r => r.published_at).slice(0, 3);
  const repoEvidence = evidence("repository", `repo-${repository.fullName}`, `Repository · ${repository.fullName}`, repository.url, repository.description ?? undefined);
  const readmePath = repository.readmePath || "README.md";
  const blobPath = [repository.defaultBranch, ...readmePath.split("/")].map(part => encodeURIComponent(part)).join("/");
  const readmeEvidence = repository.readme
    ? evidence("readme", `readme-${repository.fullName}`, `README · ${repository.fullName}`, `${repository.url}/blob/${blobPath}`, repository.readme)
    : undefined;

  // A released version is the strongest available signal for a feature being shipped.
  for (const release of publishedReleases.slice(0, 2)) {
    const text = releaseText(release);
    const relatedPr = mergedPulls.find(p => text.toLowerCase().includes(`#${p.number}`) || (p.title.length > 12 && text.toLowerCase().includes(p.title.toLowerCase())));
    const ev = [evidenceFromRelease(release)];
    if (relatedPr) ev.push(evidenceFromPr(relatedPr));
    add(makeStory({
      category: "New feature shipped", title: clean(release.name) || `What's new in ${release.tag_name}`,
      summary: `The repository has a published release, ${release.tag_name}. Review its notes to identify concrete capabilities or improvements to share.`,
      angle: "Lead with the concrete change documented in the release notes. Avoid claims about user impact unless another source supports them.",
      confidence: release.body?.trim() ? "high" : "medium", status: release.body?.trim() ? "ready-to-draft" : "needs-context", evidence: ev,
      sourceFacts: [`Published release tag: ${release.tag_name}`, ...(release.published_at ? [`Published at ${release.published_at}`] : [])],
      requiresContext: release.body?.trim() ? undefined : "What changed in this release, and what should users know about it?"
    }, scannedAt));
  }

  // Merged feature work is useful, but it is not proof that a change has shipped to users.
  for (const pr of mergedPulls.filter(p => isFeature(prText(p))).slice(0, 5)) {
    if (publishedReleases.some(r => prIsRepresentedInRelease(pr, r))) continue;
    add(makeStory({
      category: "New feature shipped", title: pr.title.replace(/^(feat|feature)(\([^)]*\))?:\s*/i, ""),
      summary: `Pull request #${pr.number} was merged. The repository evidence describes implementation work, but does not independently confirm that it has reached users.`,
      angle: "Explain the capability documented by the PR, and confirm availability before calling it shipped.",
      confidence: pr.body?.trim() ? "medium" : "low", status: "needs-context", evidence: [evidenceFromPr(pr)],
      sourceFacts: [`PR #${pr.number} was merged${pr.merged_at ? ` on ${pr.merged_at}` : ""}.`, bodyExcerpt(pr.body, 220)].filter(Boolean),
      requiresContext: "Is this feature available to users yet? If so, what is the most important thing it enables?"
    }, scannedAt));
  }

  // Bug and problem-solving stories: tie the problem to a fix whenever the PR description names an issue.
  const fixingPulls = mergedPulls.filter(p => isFix(prText(p))).slice(0, 7);
  for (const pr of fixingPulls.slice(0, 4)) {
    const issueRefs = [...`${pr.title} ${pr.body ?? ""}`.matchAll(/(?:fixes|closes|resolves)\s+#(\d+)/gi)].map(m => Number(m[1]));
    const relatedIssue = issues.find(issue => issueRefs.includes(issue.number));
    add(makeStory({
      category: "Bug fixed / problem solved", title: pr.title.replace(/^(fix|bug)(\([^)]*\))?:\s*/i, ""),
      summary: relatedIssue
        ? `The repository links PR #${pr.number} to issue #${relatedIssue.number}, connecting a documented problem to a merged change.`
        : `Merged PR #${pr.number} describes a fix or reliability change. Its description provides the available evidence for the problem and solution.`,
      angle: "Describe the observed failure, the change made, and the test or evidence that supports the fix. Do not invent how often it occurred or its customer impact.",
      confidence: relatedIssue && pr.body?.trim() ? "high" : "medium", status: "ready-to-draft", evidence: [...(relatedIssue ? [evidenceFromIssue(relatedIssue)] : []), evidenceFromPr(pr)],
      sourceFacts: [pr.title, bodyExcerpt(pr.body, 220)].filter(Boolean),
      requiresContext: relatedIssue ? undefined : "What user-visible or developer-visible behavior did this fix address?"
    }, scannedAt));
  }

  // Closed issue signals an addressed problem but should not automatically be described as fixed without corroboration.
  for (const issue of issues.filter(i => i.state === "closed" && isFix(`${i.title} ${i.body ?? ""}`)).slice(0, 3)) {
    const relatedPr = mergedPulls.find(p => new RegExp(`(?:fixes|closes|resolves)\\s+#${issue.number}\\b`, "i").test(`${p.title} ${p.body ?? ""}`));
    if (!relatedPr) continue;
    add(makeStory({
      category: "Bug fixed / problem solved", title: issue.title,
      summary: `Closed issue #${issue.number} can be linked to merged PR #${relatedPr.number}; together, they provide a problem-and-fix narrative.`,
      angle: "Start with the reported behavior, then explain the implementation change and verification recorded in the pull request.",
      confidence: "high", status: "ready-to-draft", evidence: [evidenceFromIssue(issue), evidenceFromPr(relatedPr)],
      sourceFacts: [bodyExcerpt(issue.body, 220), bodyExcerpt(relatedPr.body, 220)].filter(Boolean)
    }, scannedAt));
  }

  // Improvements distinct from bug stories.
  for (const pr of mergedPulls.filter(p => isImprovement(prText(p)) && !isFix(prText(p))).slice(0, 3)) {
    add(makeStory({
      category: "Product improvement", title: pr.title,
      summary: `Merged PR #${pr.number} documents an improvement or refinement. The post should describe the change rather than claim unmeasured impact.`,
      angle: "Explain what changed and why the behavior or implementation is more deliberate. Confirm any perceived user benefit with the builder.",
      confidence: pr.body?.trim() ? "medium" : "low", status: "needs-context", evidence: [evidenceFromPr(pr)],
      sourceFacts: [bodyExcerpt(pr.body, 240)].filter(Boolean),
      requiresContext: "What was unsatisfactory before this change, and what is different now?"
    }, scannedAt));
  }

  // Weekly recap from artifacts, explicitly a summary of engineering activity rather than claimed product outcomes.
  const recentMerged = mergedPulls.slice(0, 6);
  if (recentMerged.length >= 2) {
    add(makeStory({
      category: "Weekly build recap", title: `${recentMerged.length} merged changes to recap`,
      summary: `The repository has ${recentMerged.length} recent merged pull requests to group into a development update. Check dates and release status before describing it as a single week's work.`,
      angle: "Group related work into a small number of themes and say what changed. Avoid counting unrelated activity as one milestone.",
      confidence: "medium", status: "needs-context", evidence: recentMerged.slice(0, 5).map(evidenceFromPr),
      sourceFacts: recentMerged.slice(0, 5).map(p => p.title),
      requiresContext: "Which of these changes best represents your progress this week, and are any not yet available to users?"
    }, scannedAt));
  }

  // Behind-the-scenes stories from implementation details in merged PRs.
  for (const pr of mergedPulls.filter(p => (p.body ?? "").length > 450 || /test|security|accessibility|privacy|timeout|validation/i.test(prText(p))).slice(0, 2)) {
    add(makeStory({
      category: "Behind the scenes", title: `Behind the implementation: ${pr.title}`,
      summary: `PR #${pr.number} documents implementation details beyond the feature headline, potentially suitable for a behind-the-scenes post.`,
      angle: "Choose one concrete design or engineering detail. Do not imply the details guarantee security or reliability beyond what the sources verify.",
      confidence: "medium", status: "needs-context", evidence: [evidenceFromPr(pr)],
      sourceFacts: [bodyExcerpt(pr.body, 420)].filter(Boolean),
      requiresContext: "Which implementation detail would you like other builders to understand, and why does it matter?"
    }, scannedAt));
  }

  // Reverts are signals of changed direction; builder must explain the experiment and lesson.
  const reverted = commits.filter(c => /\brevert\b|\brollback\b/i.test(commitText(c))).slice(0, 2);
  for (const commit of reverted) {
    add(makeStory({
      category: "Failed experiment / changed direction", title: `A change was reverted: ${commitText(commit).split("\n")[0]}`,
      summary: "A commit message indicates a revert or rollback. Git history alone does not tell us what was learned or why the direction changed.",
      angle: "Describe the attempted approach only after confirming what it was meant to solve and what replaced it.",
      confidence: "low", status: "needs-context", evidence: [evidenceFromCommit(commit)], sourceFacts: [commitText(commit)],
      requiresContext: "What was the original approach trying to achieve, why was it reverted, and what did you do instead?"
    }, scannedAt));
  }

  // Roadmap ideas can be suggested from open issues, but always ask the builder to confirm intent.
  const openIssues = issues.filter(i => i.state === "open").slice(0, 3);
  for (const issue of openIssues.slice(0, 2)) {
    add(makeStory({
      category: "What's next / roadmap", title: `Potential next step: ${issue.title}`,
      summary: `Open issue #${issue.number} describes a possible area of work. Open issues are not a guaranteed roadmap or commitment.`,
      angle: "Share this only if it reflects a current priority and you are comfortable discussing it publicly.",
      confidence: "low", status: "needs-context", evidence: [evidenceFromIssue(issue)], sourceFacts: [bodyExcerpt(issue.body, 240)].filter(Boolean),
      requiresContext: "Is this still a priority, and is it appropriate to mention publicly?"
    }, scannedAt));
  }

  if (readmeEvidence && repository.readme) {
    add(makeStory({
      category: "Product showcase / demo", title: `Show what ${repository.name} does`,
      summary: repository.description
        ? `${repository.description} The README can help ground a product walkthrough, but the builder should confirm the current user-facing behavior.`
        : `The repository README provides project context that could support a feature walkthrough.`,
      angle: "Choose one documented capability and show the concrete steps or interface. Avoid framing intended capabilities as already working unless the docs support that.",
      confidence: "medium", status: "needs-context", evidence: [repoEvidence, readmeEvidence],
      sourceFacts: [repository.description ?? "README available", repository.language ? `Primary repository language: ${repository.language}` : ""].filter(Boolean),
      requiresContext: "Which feature is most useful to demonstrate, and do you have a screenshot or short demo?"
    }, scannedAt));
    add(makeStory({
      category: "Problem and solution", title: `Explain the problem behind ${repository.name}`,
      summary: `Repository metadata and README describe the product, but they do not necessarily establish the audience's actual pain point.`,
      angle: "Start with a problem the target audience recognizes, then connect it to the documented product approach.",
      confidence: "low", status: "needs-context", evidence: [repoEvidence, readmeEvidence],
      sourceFacts: [repository.description ?? "Project purpose should be confirmed"],
      requiresContext: "Who is this for, and what recurring problem were you trying to help them solve?"
    }, scannedAt));
  }

  if (publishedReleases.length && !stories.some(s => s.category === "Product hype / launch promotion")) {
    const release = publishedReleases[0];
    add(makeStory({
      category: "Product hype / launch promotion", title: `Promote release ${release.tag_name}`,
      summary: "A published release provides an announcement anchor, but launch availability, audience and call to action need confirmation.",
      angle: "State what is available, highlight one meaningful change and include a truthful next step.",
      confidence: "medium", status: "needs-context", evidence: [evidenceFromRelease(release)],
      sourceFacts: [`Release tag: ${release.tag_name}`],
      requiresContext: "Is this release ready to promote publicly? Where should interested users go next?"
    }, scannedAt));
  }

  // Do not add unsupported generic prompts to the discovered Story Inbox.
  // Builder prompts belong in the interview/context UI, not among evidence-backed stories.

  // Stable rank: stronger evidence and actionable stories first, then contextual opportunities.
  const rank = (s: StoryOpportunity) => (s.status === "ready-to-draft" ? 20 : 0) + (s.confidence === "high" ? 8 : s.confidence === "medium" ? 4 : 0) + s.evidence.length;
  return stories.sort((a, b) => rank(b) - rank(a));
}
