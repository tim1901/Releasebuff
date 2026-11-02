import type { StoryCategory, StoryGroup } from "@/lib/types";

export interface CategoryDefinition {
  name: StoryCategory;
  group: StoryGroup;
  description: string;
  example: string;
  evidenceHint: string;
  sourceMode: "github" | "mixed" | "builder" | "metrics";
}

export const CATEGORY_GROUPS: { name: StoryGroup; tagline: string; categories: CategoryDefinition[] }[] = [
  {
    name: "Product progress",
    tagline: "Look what I'm building",
    categories: [
      { name: "New feature shipped", group: "Product progress", description: "Announce a new capability and explain what it enables.", example: "Here's what I shipped and what it lets you do.", evidenceHint: "Merged pull requests, releases and feature changes.", sourceMode: "github" },
      { name: "Product improvement", group: "Product progress", description: "Show how an existing feature became better.", example: "The feature worked, but one interaction needed refinement.", evidenceHint: "Follow-up fixes, related changes and tests.", sourceMode: "github" },
      { name: "Bug fixed / problem solved", group: "Product progress", description: "Explain a real problem and its resolution.", example: "What broke, what changed, and how the issue was addressed.", evidenceHint: "Issues linked to fixes, pull requests and regression tests.", sourceMode: "github" },
      { name: "Weekly build recap", group: "Product progress", description: "Bring the week's meaningful work together.", example: "What I shipped, improved and learned this week.", evidenceHint: "Related commits, pull requests and releases across a time window.", sourceMode: "github" }
    ]
  },
  {
    name: "Learning and craft",
    tagline: "Here's what building taught me",
    categories: [
      { name: "Technical decision / trade-off", group: "Learning and craft", description: "Explain a meaningful technical choice and the alternatives.", example: "Why I chose this architecture over another approach.", evidenceHint: "Design docs, PR discussions, code changes and builder reasoning.", sourceMode: "mixed" },
      { name: "Lesson learned", group: "Learning and craft", description: "Turn a real experience into a useful insight.", example: "Something I learned while solving a problem.", evidenceHint: "Tests, fixes, incident notes and builder context.", sourceMode: "mixed" },
      { name: "Failed experiment / changed direction", group: "Learning and craft", description: "Share an approach that did not work and what changed.", example: "I tried one approach, found its limits and changed course.", evidenceHint: "Reverts, alternative implementations, experiments and builder explanation.", sourceMode: "mixed" },
      { name: "Behind the scenes", group: "Learning and craft", description: "Reveal an interesting engineering detail users rarely see.", example: "What it took to make a seemingly simple feature work well.", evidenceHint: "Architecture, implementation detail, tests and documentation.", sourceMode: "github" }
    ]
  },
  {
    name: "Product marketing",
    tagline: "Here's why you might want this",
    categories: [
      { name: "Product showcase / demo", group: "Product marketing", description: "Demonstrate a real feature or workflow.", example: "Here's how the product works in practice.", evidenceHint: "README, product docs, screenshots and real demo material.", sourceMode: "mixed" },
      { name: "Problem and solution", group: "Product marketing", description: "Connect a relevant audience problem to the product.", example: "The problem I wanted to solve and how the product approaches it.", evidenceHint: "PRD, landing page, audience context and customer research.", sourceMode: "mixed" },
      { name: "Product hype / launch promotion", group: "Product marketing", description: "Build anticipation, announce a launch or promote a release.", example: "What's new, why it matters and how to try it.", evidenceHint: "Confirmed launch plan, release notes, availability and call to action.", sourceMode: "mixed" },
      { name: "What's next / roadmap", group: "Product marketing", description: "Share upcoming priorities or planned capabilities.", example: "What I'm exploring next and why.", evidenceHint: "A current roadmap, confirmed planned issues or builder approval.", sourceMode: "mixed" }
    ]
  },
  {
    name: "Audience and growth",
    tagline: "Help me make this better",
    categories: [
      { name: "Ask the audience", group: "Audience and growth", description: "Invite feedback on a genuine question or decision.", example: "How would you approach this product decision?", evidenceHint: "A real open question and the feedback the builder wants.", sourceMode: "builder" },
      { name: "Traction and milestones", group: "Audience and growth", description: "Share verified progress in users, signups, customers or revenue.", example: "A milestone reached and what it means for the product.", evidenceHint: "Verified analytics, billing data or builder-confirmed metrics.", sourceMode: "metrics" },
      { name: "Customer feedback and learning", group: "Audience and growth", description: "Explain what real user feedback revealed or changed.", example: "A user's feedback made me reconsider a feature.", evidenceHint: "Permissioned customer feedback, interviews or support notes.", sourceMode: "mixed" },
      { name: "Founder journey / personal reflection", group: "Audience and growth", description: "Share the human experience of building a product.", example: "Something I underestimated when I started building.", evidenceHint: "Personal experiences or reflections supplied by the builder.", sourceMode: "builder" }
    ]
  }
];

export const ALL_CATEGORIES: CategoryDefinition[] = CATEGORY_GROUPS.flatMap((g) => g.categories);
export const CATEGORY_NAMES: StoryCategory[] = ALL_CATEGORIES.map((c) => c.name);
export const categoryDefinition = (name: StoryCategory) => ALL_CATEGORIES.find((c) => c.name === name)!;
