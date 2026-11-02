import type { StoryOpportunity } from "@/lib/types";

const createdAt = "2026-10-31T09:00:00.000Z";
const ev = (id: string, label: string, url: string, type: StoryOpportunity["evidence"][number]["type"], excerpt?: string) => ({ id, label, url, type, excerpt });
const allTrellisDemoStories: StoryOpportunity[] = [
  {
    id: "trellis-command-palette", category: "New feature shipped", group: "Product progress", title: "A command palette for the whole workspace",
    summary: "Trellis 0.13.0 introduced a searchable palette for actions, windows, tabs, panes, saved hosts, tasks and themes.",
    angle: "Show what the feature lets people find from one place and highlight a concrete implementation detail.", confidence: "high", status: "ready-to-draft",
    evidence: [ev("pr-22", "PR #22 · Command palette", "https://github.com/bearstouch/trellis/pull/22", "pull_request", "The PR documents a searchable command palette, scope navigation, keyboard handling, and the 0.13.0 version bump."), ev("changelog-013", "Trellis 0.13.0 release notes", "https://github.com/bearstouch/trellis/blob/master/CHANGELOG.md", "release", "The changelog records the command palette and command scratchpad in v0.13.0.")],
    sourceFacts: ["The PR was merged.", "The 0.13.0 changelog lists the command palette.", "The PR notes a follow-up fix for a stale list that hid the first result."], generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-layout-bug", category: "Bug fixed / problem solved", group: "Product progress", title: "Closing a window could erase the saved workspace",
    summary: "Issue #16 described layouts being lost after closing the main window and quitting. PR #17 changed the behavior to preserve windows, tabs and splits as stopped panes.",
    angle: "Explain the failure scenario, the fix and the difference between ending terminal sessions and deleting a workspace.", confidence: "high", status: "ready-to-draft",
    evidence: [ev("issue-16", "Issue #16 · Workspace layout lost", "https://github.com/bearstouch/trellis/issues/16", "issue", "Closing the main window and quitting could leave the workspace empty on the next launch."), ev("pr-17", "PR #17 · Keep workspace layout", "https://github.com/bearstouch/trellis/pull/17", "pull_request", "The fix preserves windows, tabs and splits as stopped panes and adds a persistence test. The PR listed manual bundled-app verification as pending.")],
    sourceFacts: ["Issue #16 reports workspace layouts being lost.", "PR #17 changes window-close behavior to preserve layout.", "The PR adds a persistence test.", "Manual bundled-app verification was still pending in the PR description."], generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-scratchpad", category: "Product showcase / demo", group: "Product marketing", title: "Write and run commands beside your terminal",
    summary: "The command scratchpad supports shell commands, scripts and Markdown notes. It includes syntax validation and lets users save scripts as tasks.",
    angle: "Demonstrate a documented workflow from writing a command to validating or running it.", confidence: "high", status: "ready-to-draft",
    evidence: [ev("pr-20", "PR #20 · Command scratchpad", "https://github.com/bearstouch/trellis/pull/20", "pull_request", "The PR documents editing, validating, running and saving scripts as tasks beside terminal panes.")],
    sourceFacts: ["Scratchpad supports sh, bash, JavaScript and Markdown.", "Syntax validation has a five-second limit.", "Scripts can be saved as tasks.", "The PR describes safeguards around temporary files and unsaved changes."], generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-scratchpad-safeguards", category: "Behind the scenes", group: "Learning and craft", title: "The safeguards behind a command scratchpad",
    summary: "The implementation uses private temporary copies, a five-second syntax-check limit, checks for an idle shell before running commands, and review behavior for certain task executions.",
    angle: "Show one tangible engineering safeguard behind the interface without claiming all risks are eliminated.", confidence: "high", status: "ready-to-draft",
    evidence: [ev("pr-20-safety", "PR #20 · Scratchpad implementation details", "https://github.com/bearstouch/trellis/pull/20", "pull_request", "The PR describes validation timeouts, private temporary files, environment cleanup, and task review behavior.")],
    sourceFacts: ["The syntax validator uses a five-second limit.", "The implementation creates private temporary copies.", "Task execution has trust review behavior."], generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-auto-update", category: "Product improvement", group: "Product progress", title: "In-app software update checks and installation",
    summary: "PR #24 adds an update-check interface and software-update installation flow using Sparkle. The PR lists several end-to-end update scenarios as pending.",
    angle: "Describe the capability and be transparent that some end-to-end checks were still pending in the PR notes.", confidence: "medium", status: "ready-to-draft",
    evidence: [ev("pr-24", "PR #24 · Sparkle software updates", "https://github.com/bearstouch/trellis/pull/24", "pull_request", "The PR documents the update UI, HTTPS appcast request and pending end-to-end scenarios.")],
    sourceFacts: ["The PR adds update checks and installation using Sparkle.", "System profiling is configured off.", "Several end-to-end update scenarios are listed as pending in the PR."], generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-release-summary", category: "Weekly build recap", group: "Product progress", title: "A recap of the command palette and scratchpad work",
    summary: "The repository records a command scratchpad in PR #20 and a command palette with release 0.13.0 in PR #22. These are related developer-workflow capabilities, though the source dates should be checked before calling them one week of work.",
    angle: "Group the two capabilities into a concise development recap and state only what the PRs and release notes support.", confidence: "high", status: "ready-to-draft",
    evidence: [ev("pr-20-week", "PR #20 · Command scratchpad", "https://github.com/bearstouch/trellis/pull/20", "pull_request"), ev("pr-22-week", "PR #22 · Command palette", "https://github.com/bearstouch/trellis/pull/22", "pull_request")],
    sourceFacts: ["PR #20 documents a command scratchpad.", "PR #22 documents a command palette and version 0.13.0."], requiresContext: "Which of these two capabilities best represents the progress you want to share, and were they available to users during the same period?", generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-update-design", category: "Technical decision / trade-off", group: "Learning and craft", title: "The implementation choices behind software updates",
    summary: "PR #24 documents an HTTPS appcast request, disabled system profiling and a signed update-feed process. The implementation is visible; the developer's reasons need confirmation.",
    angle: "Explain the documented design choice and ask the builder to supply its motivation before making it an opinion-led story.", confidence: "medium", status: "needs-context",
    evidence: [ev("pr-24-decision", "PR #24 · Updater configuration", "https://github.com/bearstouch/trellis/pull/24", "pull_request")],
    sourceFacts: ["The update check requests an HTTPS appcast.", "System profiling is disabled by default.", "Feed publication involves signed artifacts."], requiresContext: "What trade-off mattered most when implementing software updates, and why did you choose this approach?", generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-problem-solution", category: "Problem and solution", group: "Product marketing", title: "Explain the workspace problem Trellis addresses",
    summary: "Trellis is described as a native macOS terminal with managed windows, tabs, panes, saved SSH hosts and automation interfaces. The specific audience pain should be confirmed by the builder.",
    angle: "Connect a real workflow problem to a documented capability, once the target audience and problem are confirmed.", confidence: "medium", status: "needs-context",
    evidence: [ev("repo-trellis", "Trellis public repository", "https://github.com/bearstouch/trellis", "repository"), ev("readme-trellis", "Trellis README", "https://github.com/bearstouch/trellis/blob/master/README.md", "readme")],
    sourceFacts: ["Trellis is a native macOS terminal.", "The repository documents windows, tabs, panes, saved SSH hosts and automation."], requiresContext: "Which workflow problem does your target user experience most often, and which Trellis capability helps with it?", generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-roadmap", category: "What's next / roadmap", group: "Product marketing", title: "Confirm a possible next step from an open issue",
    summary: "An open issue can suggest an area of interest, but it does not prove that the work is planned or will ship.", angle: "Only discuss a future capability after the builder confirms it remains a priority and is safe to share.", confidence: "low", status: "needs-context",
    evidence: [ev("repo-issues", "Open issues in Trellis", "https://github.com/bearstouch/trellis/issues", "issue")], sourceFacts: [], requiresContext: "Which upcoming improvement, if any, are you comfortable talking about publicly?", generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-ask-audience", category: "Ask the audience", group: "Audience and growth", title: "Ask for feedback on an open product decision",
    summary: "A repository can reveal unresolved issues, but the builder should choose the question and feedback they actually want.", angle: "Ask one specific question that could inform a genuine decision, not a generic engagement question.", confidence: "low", status: "needs-context", evidence: [], sourceFacts: [], requiresContext: "What product decision are you still weighing, and what kind of feedback would help?", generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-traction", category: "Traction and milestones", group: "Audience and growth", title: "Share a verified product milestone",
    summary: "GitHub stars, commits and PR counts are not the same as product users, customers or revenue. No customer-traction figures are included in this demo.", angle: "Use a verified metric with a clear time period and no unsupported causality.", confidence: "low", status: "needs-context", evidence: [], sourceFacts: [], requiresContext: "Do you have a verified users, signup, customer or revenue milestone you want to share?", generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-customer-feedback", category: "Customer feedback and learning", group: "Audience and growth", title: "Turn real user feedback into a story",
    summary: "The reviewed repository artifacts do not establish what a customer said or how users responded.", angle: "Use feedback that you are permitted to share, and explain only the change it actually influenced.", confidence: "low", status: "needs-context", evidence: [], sourceFacts: [], requiresContext: "What feedback did a user share, and what did it cause you to reconsider?", generatedAt: createdAt, demo: true
  },
  {
    id: "trellis-founder-reflection", category: "Founder journey / personal reflection", group: "Audience and growth", title: "Share a personal lesson from building Trellis",
    summary: "A public repository shows development artifacts but cannot reliably tell us the builder's feelings, motivation or personal experience.", angle: "Let the builder supply the personal story, then help shape it without inventing emotions or events.", confidence: "low", status: "needs-context", evidence: [], sourceFacts: [], requiresContext: "What has surprised you most about building this product so far?", generatedAt: createdAt, demo: true
  }
];

// Keep the sample inbox evidence-backed. Categories that require personal or metric evidence are prompts for a later interview, not fabricated demo stories.
export const TRELLIS_DEMO_STORIES: StoryOpportunity[] = allTrellisDemoStories.filter(story => story.evidence.length > 0);
