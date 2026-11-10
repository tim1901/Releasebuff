export type StoryCategory =
  | "New feature shipped"
  | "Product improvement"
  | "Bug fixed / problem solved"
  | "Weekly build recap"
  | "Technical decision / trade-off"
  | "Lesson learned"
  | "Failed experiment / changed direction"
  | "Behind the scenes"
  | "Product showcase / demo"
  | "Problem and solution"
  | "Product hype / launch promotion"
  | "What's next / roadmap"
  | "Ask the audience"
  | "Traction and milestones"
  | "Customer feedback and learning"
  | "Founder journey / personal reflection";

export type StoryGroup = "Product progress" | "Learning and craft" | "Product marketing" | "Audience and growth";
export type StoryStatus = "new" | "needs-context" | "ready-to-draft" | "drafted" | "scheduled" | "dismissed" | "published";
export type EvidenceType = "repository" | "pull_request" | "issue" | "commit" | "release" | "readme" | "documentation" | "document" | "website" | "screenshot" | "builder_note" | "analytics" | "customer_feedback";

export interface StoryEvidence {
  id: string;
  label: string;
  url: string;
  type: EvidenceType;
  excerpt?: string;
  sourceStatus?: KnowledgeStatus;
  collectedAt?: string;
  claimSupports?: string[];
}

export interface StoryOpportunity {
  id: string;
  category: StoryCategory;
  group: StoryGroup;
  title: string;
  summary: string;
  angle: string;
  confidence: "high" | "medium" | "low";
  status: StoryStatus;
  evidence: StoryEvidence[];
  sourceFacts: string[];
  requiresContext?: string;
  generatedAt: string;
  demo?: boolean;
  whyItMatters?: string;
  evidenceCoverage?: "strong" | "partial" | "context-needed";
}

export interface GitHubRepository {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  updatedAt: string;
  readme: string | null;
  readmePath?: string | null;
  topics: string[];
  dataWarnings: string[];
}

export interface GitHubAnalysis {
  repository: GitHubRepository;
  stories: StoryOpportunity[];
  scannedAt: string;
  scannedArtifacts: { commits: number; pullRequests: number; issues: number; releases: number };
  rateLimit?: { remaining: string | null; reset: string | null };
}

export interface LocalDraft {
  id: string;
  storyId?: string;
  title: string;
  text: string;
  platform: "linkedin" | "x";
  category: StoryCategory;
  evidence: StoryEvidence[];
  status: "draft" | "scheduled" | "published" | "local-only";
  createdAt: string;
  updatedAt: string;
  bufferPostId?: string;
  dueAt?: string;
  channelName?: string;
  interviewSummary?: string;
  writingPreferences?: StoryWritingPreferences;
}

export type BrandVisualStyle = "editorial" | "technical" | "bold" | "minimal";
export type BrandAspectRatio = "square" | "landscape" | "portrait";
export type BrandFontFamily = "Hanken Grotesk" | "JetBrains Mono" | "Georgia" | "Arial";

export interface BrandKit {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  theme: "light" | "dark";
  style: BrandVisualStyle;
  fontFamily: BrandFontFamily;
  aspectRatio: BrandAspectRatio;
}

export type ProductStage = "idea" | "prototype" | "actively-building" | "early-launch" | "established";
export type KnowledgeStatus = "source-supported" | "builder-provided" | "hypothesis" | "unknown";

export interface ProductProfileFact {
  id: string;
  field: string;
  value: string;
  status: KnowledgeStatus;
  sourceIds: string[];
}

export interface ProductProfile {
  productName: string;
  oneLineDescription: string;
  problem: string;
  targetAudience: string;
  valueProposition: string;
  productStage: ProductStage;
  capabilities: string[];
  differentiators: string[];
  facts: ProductProfileFact[];
  unknowns: string[];
  updatedAt: string;
  generatedBy: "ai" | "local-summary";
}

export type ProductMaterialKind = "document" | "url" | "note" | "screenshot";
export interface ProductMaterial {
  id: string;
  kind: ProductMaterialKind;
  title: string;
  sourceUrl?: string;
  mimeType?: string;
  textContent?: string;
  dataUrl?: string;
  addedAt: string;
  collectedAt?: string;
  sourceStatus: "user-provided" | "fetched" | "pending" | "error";
  error?: string;
}

export interface StoryInterviewAnswer {
  question: string;
  answer: string;
  skipped?: boolean;
  dimension?: string;
}
export interface StoryInterview {
  storyId: string;
  answers: StoryInterviewAnswer[];
  currentQuestion?: string;
  currentDimension?: string;
  complete: boolean;
  summary?: string;
  updatedAt: string;
}
export interface StoryWritingPreferences {
  openingStyle: "ai" | "problem" | "personal" | "specific-moment" | "question" | "custom";
  customOpening?: string;
  closingStyle: "ai" | "reflection" | "question" | "product-cta" | "next-step" | "custom";
  customClosing?: string;
}

export interface ProjectPreferences {
  productName: string;
  productStage: ProductStage;
  websiteUrl: string;
  repositoryUrl: string;
  productSummary: string;
  audience: string;
  goals: string[];
  writingVoice: string;
  useGitHubApp?: boolean;
}

export interface BufferChannel {
  id: string;
  name: string;
  displayName?: string | null;
  service: string;
  avatar?: string | null;
  organizationId: string;
  organizationName: string;
  timezone?: string;
  isDisconnected?: boolean;
  isLocked?: boolean;
  isQueuePaused?: boolean;
}

export interface BufferSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
  connectedAt: string;
}

export interface BufferApiPostResult {
  id: string;
  text?: string;
  dueAt?: string | null;
  status?: string;
  channelId?: string;
}
