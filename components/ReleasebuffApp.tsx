"use client";

import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, BookOpen, Bug, CalendarClock,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Code2, Copy, ExternalLink,
  FileCheck, FileCode2, FileText, FolderGit2, Github, Globe, Layers3, Lightbulb, LoaderCircle,
  LockKeyhole, Menu, MessageCircleQuestion, Plus, RefreshCw, Save, Search,
  Send, Settings2, Sparkles, Tag, Target, Trash2, X, CalendarDays, CheckCheck,
  Braces, WandSparkles, BookMarked, Eye, Radio, LogOut, FileUp, MessageSquareText, BrainCircuit, Palette, type LucideIcon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BrandKit, BufferChannel, GitHubAnalysis, LocalDraft, ProductMaterial, ProductProfile, ProjectPreferences, StoryCategory, StoryInterview, StoryInterviewAnswer, StoryOpportunity, StoryStatus, StoryWritingPreferences } from "@/lib/types";
import { DEFAULT_BRAND_KIT, normaliseBrandKit } from "@/lib/brand-kit";
import BrandKitStudio from "@/components/BrandKitStudio";
import StoryVisualStudio from "@/components/StoryVisualStudio";
import { localRead, localWrite } from "@/lib/local-db";
import { CATEGORY_GROUPS, ALL_CATEGORIES } from "@/lib/story-categories";
import { TRELLIS_DEMO_STORIES } from "@/lib/demo-data";
import { localDateTimeToUtc } from "@/lib/date-time";

type View = "landing" | "setup" | "inbox" | "story" | "categories" | "draft" | "library" | "brand";
type BufferAction = "draft" | "publish" | "schedule" | null;
type BufferStatus = { connected: boolean; configured: boolean; reconnectRequired?: boolean; account?: { id: string; email: string | null }; connectedAt?: string };

const LS = {
  settings: "releasebuff:settings:v1",
  analysis: "releasebuff:analysis:v1",
  stories: "releasebuff:stories:v1",
  drafts: "releasebuff:drafts:v1",
  dismissed: "releasebuff:dismissed:v1"
};
const emptySettings: ProjectPreferences = { productName: "", productStage: "actively-building", websiteUrl: "", repositoryUrl: "", productSummary: "", audience: "", goals: ["Grow an audience"], writingVoice: "Natural and specific", useGitHubApp: false };
const navItems: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "inbox", label: "Story Inbox", icon: Layers3 },
  { view: "categories", label: "Story Categories", icon: Tag },
  { view: "draft", label: "Draft Studio", icon: FileText },
  { view: "library", label: "Draft Library", icon: BookMarked },
  { view: "brand", label: "Brand Kit", icon: Palette },
  { view: "setup", label: "Project Setup", icon: Settings2 }
];
const defaultTimezone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos"; } catch { return "Africa/Lagos"; }
};
const nextLocalDate = () => {
  const date = new Date(); date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

/** Keeps requests small enough for local/serverless handlers while source originals remain browser-local. */
function materialsForServerRequest(materials: ProductMaterial[]): ProductMaterial[] {
  let mediaIncluded = false;
  return materials.slice(0, 20).map(material => {
    const { dataUrl, ...textOnly } = material;
    const safeText = textOnly.textContent ? textOnly.textContent.slice(0, 5_000) : undefined;
    if (!mediaIncluded && dataUrl && dataUrl.length <= 2_500_000) {
      mediaIncluded = true;
      return { ...textOnly, textContent: safeText, dataUrl };
    }
    return { ...textOnly, textContent: safeText };
  });
}

/** Keeps a richer saved profile when AI is unavailable, while updating fields the builder just confirmed. */
function mergeProductProfile(existing: ProductProfile | null, refreshed: ProductProfile): ProductProfile {
  if (!existing || refreshed.generatedBy === "ai" || existing.generatedBy !== "ai") return refreshed;
  const facts = new Map<string, ProductProfile["facts"][number]>();
  for (const fact of existing.facts ?? []) facts.set(fact.field.trim().toLowerCase(), fact);
  for (const fact of refreshed.facts ?? []) facts.set(fact.field.trim().toLowerCase(), fact);
  const keepExistingWhenUnknown = (fresh: string, previous: string) => !fresh.trim() || /^not yet established/i.test(fresh) ? previous : fresh;
  return {
    ...existing,
    productName: refreshed.productName || existing.productName,
    oneLineDescription: refreshed.oneLineDescription || existing.oneLineDescription,
    problem: keepExistingWhenUnknown(refreshed.problem, existing.problem),
    targetAudience: refreshed.targetAudience || existing.targetAudience,
    valueProposition: keepExistingWhenUnknown(refreshed.valueProposition, existing.valueProposition),
    productStage: refreshed.productStage,
    facts: [...facts.values()].slice(-40),
    unknowns: [...new Set([...(existing.unknowns ?? []), ...(refreshed.unknowns ?? [])])].slice(0, 30),
    updatedAt: refreshed.updatedAt,
    generatedBy: "ai"
  };
}
const fmtDate = (value: string) => {
  if (!value) return "Not scanned yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const groupIcon: Record<string, LucideIcon> = {
  "Product progress": Activity,
  "Learning and craft": Lightbulb,
  "Product marketing": Globe,
  "Audience and growth": Target
};
const categoryIcon: Record<string, LucideIcon> = {
  "New feature shipped": CheckCircle2,
  "Product improvement": Activity,
  "Bug fixed / problem solved": Bug,
  "Weekly build recap": CalendarDays,
  "Technical decision / trade-off": Braces,
  "Lesson learned": Lightbulb,
  "Failed experiment / changed direction": RefreshCw,
  "Behind the scenes": Code2,
  "Product showcase / demo": Eye,
  "Problem and solution": Target,
  "Product hype / launch promotion": Radio,
  "What's next / roadmap": CalendarClock,
  "Ask the audience": MessageCircleQuestion,
  "Traction and milestones": Activity,
  "Customer feedback and learning": MessageCircleQuestion,
  "Founder journey / personal reflection": BookOpen
};
const statusLabels: Record<StoryStatus, string> = {
  new: "New", "needs-context": "Needs context", "ready-to-draft": "Ready to draft", drafted: "Drafted", scheduled: "Scheduled", dismissed: "Dismissed", published: "Published"
};

function Button({ children, variant = "primary", size, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "lime" | "outline" | "ghost" | "danger"; size?: "sm"; className?: string }) {
  return <button {...props} className={`button ${variant === "lime" ? "button-lime" : variant === "outline" ? "button-outline" : variant === "ghost" ? "button-ghost" : variant === "danger" ? "button-danger" : ""} ${size === "sm" ? "button-sm" : ""} ${className}`}>{children}</button>;
}
function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`badge ${tone === "success" ? "badge-success" : tone === "warning" ? "badge-warning" : "badge-muted"}`}>{children}</span>;
}
function navigateToAuthEndpoint(path: string) {
  window.location.assign(new URL(path, window.location.origin).toString());
}
function Brand({ onClick }: { onClick?: () => void }) {
  return <button className="brand" onClick={onClick} aria-label="Go to Releasebuff home"><span className="brand-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 12h34l7 7H15z" fill="var(--lime)"/><path d="M13 18h25c10 0 15 5 15 13 0 6-3 10-8 12l8 8H39l-8-8h-4v8H13z" fill="#F8F8F2"/><path d="M27 25v10h8c3 0 5-2 5-5s-2-5-5-5z" fill="var(--forest)"/></svg></span><span><span className="brand-name"><span className="brand-word-release">Release</span><span className="brand-word-buff">buff</span></span><span className="brand-sub">Build in public, with intention.</span></span></button>;
}
function EvidenceSourceLink({ evidence }: { evidence: StoryOpportunity["evidence"][number] }) {
  const localOnly = !/^https?:\/\//i.test(evidence.url);
  const originLabel = evidence.sourceStatus === "source-supported" ? "Source-supported" : evidence.sourceStatus === "builder-provided" ? "Builder-provided" : evidence.sourceStatus === "hypothesis" ? "Hypothesis" : evidence.sourceStatus === "unknown" ? "Unknown" : "Source";
  const content = <><FileCheck size={12}/>{evidence.label}{localOnly ? <span className="small muted">· Local</span> : <ExternalLink size={10}/>}</>;
  return localOnly
    ? <span className="evidence-link" key={evidence.id} title={`${originLabel}; stored in this browser`}>{content}</span>
    : <a className="evidence-link" key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer" title={originLabel}>{content}</a>;
}
function EvidenceList({ story }: { story: StoryOpportunity }) {
  if (!story.evidence.length) return <p className="small muted">No external source attached yet. This opportunity requires builder context.</p>;
  return <div className="evidence-row">{story.evidence.map(e => <EvidenceSourceLink key={`${e.id}-${e.url}`} evidence={e}/>)}</div>;
}
function StoryStatusBadge({ status }: { status: StoryStatus }) {
  const tone = status === "ready-to-draft" || status === "published" || status === "drafted" ? "success" : status === "needs-context" ? "warning" : "neutral";
  return <Badge tone={tone}>{statusLabels[status]}</Badge>;
}
function IconBox({ icon: Icon, size = 18 }: { icon: LucideIcon; size?: number }) {
  return <span className="feature-icon"><Icon size={size} /></span>;
}
function StoryCard({ story, onOpen, onDraft, onDismiss }: { story: StoryOpportunity; onOpen: () => void; onDraft: () => void; onDismiss: () => void }) {
  const Icon = categoryIcon[story.category] ?? Sparkles;
  return <article className="story-card">
    <div className="story-card-top">
      <div className="grow">
        <div className="row wrap"><Badge>{story.category}</Badge><StoryStatusBadge status={story.status} />{story.demo && <Badge>Sample</Badge>}</div>
        <h2 className="story-title">{story.title}</h2>
        <p className="story-summary">{story.summary}</p>
      </div>
      <div className="feature-icon" style={{ marginBottom: 0, flexShrink: 0 }}><Icon size={18} /></div>
    </div>
    <div className="story-card-footer">
      <div className="evidence-row"><span className="eyebrow">Evidence</span>{story.evidence.slice(0, 2).map(e => <EvidenceSourceLink key={e.id} evidence={e}/>)}{!story.evidence.length && <span className="small muted">Builder input needed</span>}</div>
      <div className="story-actions">
        <Button variant="ghost" size="sm" onClick={onDismiss} title="Dismiss story"><X size={13} /> Dismiss</Button>
        <Button variant="outline" size="sm" onClick={onOpen}>Details</Button>
        <Button variant="lime" size="sm" onClick={onDraft}>Create draft <ArrowRight size={13} /></Button>
      </div>
    </div>
  </article>;
}

export default function ReleasebuffApp() {
  const [view, setView] = useState<View>("landing");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<ProjectPreferences>(emptySettings);
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [analysis, setAnalysis] = useState<GitHubAnalysis | null>(null);
  const [stories, setStories] = useState<StoryOpportunity[]>([]);
  const [analysisMode, setAnalysisMode] = useState<"none" | "demo" | "live">("none");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftPlatform, setDraftPlatform] = useState<"linkedin" | "x">("linkedin");
  const [draftMode, setDraftMode] = useState<"ai" | "grounded-template" | "none">("none");
  const [draftBusy, setDraftBusy] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftFilter, setDraftFilter] = useState("all");
  const [bufferStatus, setBufferStatus] = useState<BufferStatus>({ connected: false, configured: false });
  const [bufferChannels, setBufferChannels] = useState<BufferChannel[]>([]);
  const [channelsBusy, setChannelsBusy] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [bufferAction, setBufferAction] = useState<BufferAction>(null);
  const [bufferBusy, setBufferBusy] = useState(false);
  const [bufferError, setBufferError] = useState("");
  const [scheduleDate, setScheduleDate] = useState(nextLocalDate);
  const [scheduleTime, setScheduleTime] = useState("10:30");
  const [scheduleTimezone, setScheduleTimezone] = useState(defaultTimezone);
  const [scheduleType, setScheduleType] = useState<"automatic" | "notification">("automatic");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [health, setHealth] = useState<{ aiConfigured: boolean; claudeGifConfigured?: boolean; bufferConfigured: boolean; githubAppConfigured?: boolean; encryptedIntegrationStore?: boolean } | null>(null);
  const [productProfile, setProductProfile] = useState<ProductProfile | null>(null);
  const [productMaterials, setProductMaterials] = useState<ProductMaterial[]>([]);
  const [profileBusy, setProfileBusy] = useState(false);
  const [storyDiscoveryBusy, setStoryDiscoveryBusy] = useState(false);
  const [githubStatus, setGithubStatus] = useState<{ connected: boolean; configured: boolean }>({ connected: false, configured: false });
  const [githubBusy, setGithubBusy] = useState(false);
  const [interviews, setInterviews] = useState<Record<string, StoryInterview>>({});
  const [interviewAnswerDraft, setInterviewAnswerDraft] = useState("");
  const [interviewBusy, setInterviewBusy] = useState(false);
  const [writingPreferences, setWritingPreferences] = useState<StoryWritingPreferences>({ openingStyle: "ai", closingStyle: "ai" });
  const [draftReviewWarnings, setDraftReviewWarnings] = useState<string[]>([]);

  const activeStory = stories.find(s => s.id === selectedStoryId) ?? null;
  const selectedChannel = bufferChannels.find(c => c.id === selectedChannelId) ?? null;
  const activeInterview = activeStory ? interviews[activeStory.id] ?? null : null;
  const interviewMaterials = useMemo<ProductMaterial[]>(() => Object.values(interviews)
    .map((interview): ProductMaterial | null => {
      const story = stories.find(item => item.id === interview.storyId);
      const answers = interview.answers.filter(answer => !answer.skipped && answer.answer.trim());
      const textContent = [
        interview.summary ? `Interview summary: ${interview.summary}` : "",
        ...answers.map(answer => `Q: ${answer.question}\nA: ${answer.answer}`)
      ].filter(Boolean).join("\n\n").slice(0, 5_000);
      if (!textContent.trim()) return null;
      return {
        id: `interview-${interview.storyId}`,
        kind: "note" as const,
        title: `Builder interview: ${story?.title ?? interview.storyId}`,
        textContent,
        addedAt: interview.updatedAt,
        sourceStatus: "user-provided" as const
      };
    })
    .filter((item): item is ProductMaterial => item !== null)
    .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
    .slice(0, 6), [interviews, stories]);

  const say = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(current => current?.message === message ? null : current), 5000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const readPersisted = async <T,>(idbKey: string, localKey?: string): Promise<T | null> => {
      try {
        const stored = await localRead<T>(idbKey);
        if (stored !== null) return stored;
      } catch { /* Continue with the migration/fallback store when IndexedDB is unavailable. */ }
      if (localKey) {
        try {
          const raw = localStorage.getItem(localKey);
          if (raw) {
            const value = JSON.parse(raw) as T;
            localWrite(idbKey, value).catch(() => undefined);
            return value;
          }
        } catch { /* Malformed browser-local data is ignored. */ }
      }
      return null;
    };
    const hydrate = async () => {
      const [savedSettings, savedAnalysis, savedStories, savedDrafts, savedDismissed, savedProfile, savedMaterials, savedInterviews, savedBrandKit] = await Promise.all([
        readPersisted<Partial<ProjectPreferences>>("settings", LS.settings),
        readPersisted<GitHubAnalysis>("analysis", LS.analysis),
        readPersisted<StoryOpportunity[]>("stories", LS.stories),
        readPersisted<LocalDraft[]>("drafts", LS.drafts),
        readPersisted<string[]>("dismissed", LS.dismissed),
        readPersisted<ProductProfile>("product-profile"),
        readPersisted<ProductMaterial[]>("product-materials"),
        readPersisted<Record<string, StoryInterview>>("story-interviews"),
        readPersisted<Partial<BrandKit>>("brand-kit")
      ]);
      if (cancelled) return;
      if (savedSettings) setSettings({ ...emptySettings, ...savedSettings });
      if (savedAnalysis) { setAnalysis(savedAnalysis); setAnalysisMode("live"); }
      if (savedStories) setStories(savedStories);
      if (savedDrafts) setDrafts(savedDrafts);
      if (savedDismissed) setDismissedIds(savedDismissed);
      if (savedProfile) setProductProfile(savedProfile);
      if (savedMaterials) setProductMaterials(savedMaterials);
      if (savedInterviews) setInterviews(savedInterviews);
      if (savedBrandKit) setBrandKit(normaliseBrandKit(savedBrandKit));
      setHydrated(true);
    };
    void hydrate();
    const query = new URLSearchParams(window.location.search);
    const bufferResult = query.get("buffer");
    const githubResult = query.get("github");
    const notice = query.get("notice");
    // OAuth callback URLs can request the setup screen; this is a one-time URL-to-view synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (query.get("view") === "setup") setView("setup");
    if (bufferResult === "connected") say("Buffer connected. Loading your channels…", "success");
    if (bufferResult === "denied") say("Buffer authorization was declined. You can connect it whenever you're ready.", "info");
    if (bufferResult && !["connected", "denied"].includes(bufferResult)) say("Buffer connection did not complete. Check your OAuth configuration and try again.", "error");
    if (githubResult === "connected") say("GitHub connected. You can scan repositories selected in the GitHub App installation.", "success");
    if (githubResult && githubResult !== "connected") say("GitHub connection did not complete. Check the GitHub App configuration and selected repositories.", "error");
    if (notice === "buffer-config-missing") say("Add the Buffer OAuth environment variables to .env.local before connecting.", "error");
    if (notice === "github-config-missing") say("Add GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_ID, GITHUB_APP_SLUG and GITHUB_APP_PRIVATE_KEY to .env.local before connecting GitHub.", "error");
    if (bufferResult || githubResult || notice || query.get("view")) window.history.replaceState({}, "", window.location.pathname);
    fetch("/api/health", { cache: "no-store" }).then(r => r.json()).then(d => setHealth({ aiConfigured: Boolean(d.capabilities?.aiDrafts), claudeGifConfigured: Boolean(d.capabilities?.claudeGifExplainer), bufferConfigured: Boolean(d.capabilities?.bufferOAuth), githubAppConfigured: Boolean(d.capabilities?.privateGitHubApp), encryptedIntegrationStore: Boolean(d.capabilities?.encryptedIntegrationStore) })).catch(() => undefined);
    fetch("/api/github/status", { cache: "no-store" }).then(r => r.json()).then((d: { connected: boolean; configured: boolean }) => setGithubStatus(d)).catch(() => undefined);
    fetch("/api/buffer/status", { cache: "no-store" }).then(r => r.json()).then(async (d: BufferStatus) => {
      setBufferStatus(d);
      if (d.connected) {
        try {
          setChannelsBusy(true);
          const res = await fetch("/api/buffer/channels", { cache: "no-store" });
          const payload = await res.json();
          if (res.ok && Array.isArray(payload.channels)) {
            setBufferChannels(payload.channels);
            setSelectedChannelId((prev: string) => prev || payload.channels[0]?.id || "");
          }
        } catch { /* Status remains connected; channels can be refreshed from Project Setup. */ }
        finally { setChannelsBusy(false); }
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  // One-time hydration and connection check.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const values: Array<[string, unknown]> = [
      ["settings", settings], ["analysis", analysis], ["stories", stories], ["drafts", drafts],
      ["dismissed", dismissedIds], ["product-profile", productProfile], ["product-materials", productMaterials], ["story-interviews", interviews], ["brand-kit", brandKit]
    ];
    Promise.all(values.map(([key, value]) => localWrite(key, value).catch(() => undefined)));
    // Keep small legacy-compatible mirrors for migration and browsers where IndexedDB is disabled.
    try {
      localStorage.setItem(LS.settings, JSON.stringify(settings));
      localStorage.setItem(LS.analysis, analysis ? JSON.stringify(analysis) : "");
      localStorage.setItem(LS.stories, JSON.stringify(stories));
      localStorage.setItem(LS.drafts, JSON.stringify(drafts));
      localStorage.setItem(LS.dismissed, JSON.stringify(dismissedIds));
    } catch { /* IndexedDB remains the primary store for richer data. */ }
  }, [hydrated, settings, analysis, stories, drafts, dismissedIds, productProfile, productMaterials, interviews, brandKit]);

  const refreshChannels = useCallback(async () => {
    setChannelsBusy(true);
    try {
      const response = await fetch("/api/buffer/channels", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Buffer channels.");
      setBufferChannels(data.channels ?? []);
      setSelectedChannelId(prev => data.channels?.some((c: BufferChannel) => c.id === prev) ? prev : data.channels?.[0]?.id ?? "");
      say("Buffer channels refreshed.", "success");
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not load Buffer channels.", "error");
    } finally { setChannelsBusy(false); }
  }, [say]);

  const buildProductProfile = useCallback(async () => {
    if (!settings.productName.trim() || !settings.productSummary.trim()) {
      say("Add a product name and a short description first. You can leave every source optional.", "error");
      return;
    }
    setProfileBusy(true);
    try {
      let materialsForProfile = [...interviewMaterials, ...productMaterials].slice(0, 20);
      const website = settings.websiteUrl.trim();
      const alreadyAdded = website && materialsForProfile.some(item => item.sourceUrl && item.sourceUrl.replace(/\/$/, "") === website.replace(/\/$/, ""));
      if (website && !alreadyAdded) {
        try {
          const sourceResponse = await fetch("/api/sources/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: website }), cache: "no-store" });
          const sourceData = await sourceResponse.json();
          if (sourceResponse.ok && typeof sourceData.text === "string") {
            const parsedUrl = new URL(String(sourceData.url || website));
            const websiteMaterial: ProductMaterial = { id: crypto.randomUUID(), kind: "url", title: parsedUrl.hostname + parsedUrl.pathname, sourceUrl: parsedUrl.href, mimeType: String(sourceData.contentType || "text/html"), textContent: String(sourceData.text).slice(0, 30_000), addedAt: new Date().toISOString(), collectedAt: String(sourceData.collectedAt || new Date().toISOString()), sourceStatus: "fetched" };
            materialsForProfile = [websiteMaterial, ...materialsForProfile];
            setProductMaterials(prev => [websiteMaterial, ...prev.filter(item => item.id !== websiteMaterial.id)]);
          } else {
            say(`The product website could not be read (${sourceData.error || "page unavailable"}). I'll continue with the other information you provided.`, "info");
          }
        } catch {
          say("The product website could not be fetched. I'll continue with the other information you provided.", "info");
        }
      }
      const response = await fetch("/api/product/understand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, materials: materialsForServerRequest(materialsForProfile), existingProfile: productProfile, includeGitHub: false, useGitHubApp: Boolean(settings.useGitHubApp) }), cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not create the Product Profile.");
      const profile = mergeProductProfile(productProfile, data.profile as ProductProfile);
      setProductProfile(profile);
      setSettings(prev => ({ ...prev, productName: profile.productName || prev.productName, productSummary: profile.oneLineDescription || prev.productSummary, audience: profile.targetAudience || prev.audience }));
      say(data.mode === "ai" ? "Product Profile created from your description and supplied sources." : "Product Profile created. Add an OpenAI key for deeper source analysis.", "success");
      if (!stories.length) {
        const profileStory: StoryOpportunity = {
          id: `product-intro-${profile.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          category: "Problem and solution", group: "Product marketing", title: `What I'm building: ${profile.productName}`,
          summary: profile.oneLineDescription || settings.productSummary,
          angle: "Introduce the product and the problem the builder wants to solve. Keep the distinction between the builder's intention and verified product capabilities explicit.",
          confidence: "medium", status: "needs-context",
          evidence: [{ id: `builder-profile-${profile.updatedAt}`, label: "Builder-provided Product Profile", type: "builder_note", url: "#product-profile", excerpt: (profile.oneLineDescription || settings.productSummary).slice(0, 280) }],
          sourceFacts: [profile.oneLineDescription || settings.productSummary, ...(profile.targetAudience ? [`Intended audience: ${profile.targetAudience}`] : [])],
          requiresContext: "What led you to start building this product, and what do you most want potential users to understand?",
          whyItMatters: "A builder-provided description is enough to start introducing an idea before launch; the interview captures the personal perspective.", evidenceCoverage: "partial", generatedAt: new Date().toISOString()
        };
        setStories([profileStory]); setSelectedStoryId(profileStory.id); setAnalysisMode("none"); setView("inbox");
      }
    } catch (error) { say(error instanceof Error ? error.message : "Could not create the Product Profile.", "error"); }
    finally { setProfileBusy(false); }
  }, [settings, productMaterials, interviewMaterials, productProfile, stories.length, say]);

  const addProductMaterial = useCallback((material: ProductMaterial) => {
    setProductMaterials(prev => [material, ...prev.filter(item => item.id !== material.id)]);
    say(`Added source: ${material.title}`, "success");
  }, [say]);
  const removeProductMaterial = useCallback((materialId: string) => {
    setProductMaterials(prev => prev.filter(item => item.id !== materialId));
    say("Source removed from this browser's Product Profile.", "info");
  }, [say]);

  const findStories = useCallback(async (githubStoriesOverride?: StoryOpportunity[]) => {
    const normalizeRepositoryUrl = (value?: string) => (value ?? "").trim().replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
    const configuredRepositoryUrl = normalizeRepositoryUrl(settings.repositoryUrl);
    const analyzedRepositoryUrl = normalizeRepositoryUrl(analysis?.repository.url);
    const currentAnalysis = configuredRepositoryUrl && configuredRepositoryUrl === analyzedRepositoryUrl ? analysis : null;
    const githubStories = githubStoriesOverride ?? currentAnalysis?.stories ?? [];
    if (!settings.productName.trim() || !settings.productSummary.trim()) {
      say("Add a product name and short description first. GitHub is optional.", "error");
      setView("setup");
      return;
    }
    setStoryDiscoveryBusy(true);
    setScanError("");
    try {
      let sourceMaterials = [...productMaterials];
      const website = settings.websiteUrl.trim();
      const alreadyAdded = website && sourceMaterials.some(item => item.sourceUrl && item.sourceUrl.replace(/\/$/, "") === website.replace(/\/$/, ""));
      if (website && !alreadyAdded) {
        try {
          const sourceResponse = await fetch("/api/sources/fetch", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: website }), cache: "no-store"
          });
          const sourceData = await sourceResponse.json();
          if (sourceResponse.ok && typeof sourceData.text === "string") {
            const parsedUrl = new URL(String(sourceData.url || website));
            const websiteMaterial: ProductMaterial = {
              id: crypto.randomUUID(), kind: "url", title: parsedUrl.hostname + parsedUrl.pathname,
              sourceUrl: parsedUrl.href, mimeType: String(sourceData.contentType || "text/html"),
              textContent: String(sourceData.text).slice(0, 30_000), addedAt: new Date().toISOString(),
              collectedAt: String(sourceData.collectedAt || new Date().toISOString()), sourceStatus: "fetched"
            };
            sourceMaterials = [websiteMaterial, ...sourceMaterials];
          }
        } catch { /* Website context is optional; continue with the builder's supplied information. */ }
      }

      const materialsForDiscovery = [...interviewMaterials, ...sourceMaterials].slice(0, 20);

      let currentProfile: ProductProfile | null = null;
      try {
        const profileResponse = await fetch("/api/product/understand", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings, materials: materialsForServerRequest(materialsForDiscovery), existingProfile: productProfile, includeGitHub: false }),
          cache: "no-store"
        });
        const profileData = await profileResponse.json();
        if (profileResponse.ok && profileData.profile) {
          currentProfile = mergeProductProfile(productProfile, profileData.profile as ProductProfile);
          setProductProfile(currentProfile);
        }
      } catch { /* Story discovery remains available from current product details and materials. */ }
      if (sourceMaterials.length !== productMaterials.length || sourceMaterials.some((item, index) => item.id !== productMaterials[index]?.id)) {
        setProductMaterials(sourceMaterials);
      }

      const response = await fetch("/api/stories/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          profile: currentProfile ?? productProfile,
          materials: materialsForServerRequest(materialsForDiscovery),
          githubStories
        }),
        cache: "no-store"
      });
      const data = await response.json() as { stories?: StoryOpportunity[]; mode?: string; warning?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not find stories from your product context.");
      const foundStories = (Array.isArray(data.stories) ? data.stories : []).filter(story => !dismissedIds.includes(story.id));
      if (!foundStories.length) throw new Error("No stories could be prepared yet. Add a little more context in Product Setup and try again.");
      setStories(foundStories);
      setSelectedStoryId(foundStories[0]?.id ?? null);
      setSelectedCategory("All categories");
      setSearchQuery("");
      setAnalysisMode(githubStoriesOverride !== undefined ? "live" : currentAnalysis ? analysisMode : "none");
      if (githubStoriesOverride === undefined && !currentAnalysis && analysis) setAnalysis(null);
      setView("inbox");
      setMobileNavOpen(false);
      const contextSummary = [
        currentProfile ? "Product Intelligence Profile" : "current product details",
        `${materialsForDiscovery.length} supporting source(s)`,
        githubStories.length ? "optional GitHub evidence" : ""
      ].filter(Boolean).join(", ");
      if (data.mode === "evidence-rules" && data.warning) say(`Found ${foundStories.length} starting points using ${contextSummary}. ${data.warning}`, "info");
      else say(`Found ${foundStories.length} story opportunities using ${contextSummary}.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not find stories from your product context.";
      setScanError(message);
      say(message, "error");
    } finally {
      setStoryDiscoveryBusy(false);
    }
  }, [settings, productMaterials, productProfile, analysis, analysisMode, dismissedIds, interviewMaterials, say]);

  const disconnectGitHub = useCallback(async () => {
    try {
      const response = await fetch("/api/github/disconnect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not disconnect GitHub.");
      setGithubStatus(prev => ({ ...prev, connected: false }));
      setSettings(prev => ({ ...prev, useGitHubApp: false }));
      say("GitHub installation disconnected from this Releasebuff session. You can also uninstall the app in GitHub settings.", "success");
    } catch (error) { say(error instanceof Error ? error.message : "Could not disconnect GitHub.", "error"); }
  }, [say]);

  const updateStoryStatus = useCallback((storyId: string, status: StoryStatus) => {
    setStories(prev => prev.map(s => s.id === storyId ? { ...s, status } : s));
  }, []);

  const getNextInterviewQuestion = useCallback(async (story: StoryOpportunity, answers: StoryInterviewAnswer[]) => {
    setInterviewBusy(true);
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, productProfile, productDescription: settings.productSummary, materials: materialsForServerRequest([...interviewMaterials, ...productMaterials]), answers }), cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not continue the story interview.");
      const fallbackSummary = answers.filter(a => !a.skipped && a.answer.trim()).map(a => `${a.dimension ?? "Context"}: ${a.answer.trim()}`).join("\n");
      const current: StoryInterview = { storyId: story.id, answers, currentQuestion: data.question, currentDimension: data.dimension, complete: Boolean(data.done), summary: typeof data.summary === "string" && data.summary.trim() ? data.summary : (data.done ? fallbackSummary : undefined), updatedAt: new Date().toISOString() };
      setInterviews(prev => ({ ...prev, [story.id]: current }));
      setInterviewAnswerDraft("");
      if (data.done) {
        say("Story interview complete. Review the summary and continue to the Story Brief.", "success");
        updateStoryStatus(story.id, "ready-to-draft");
      }
    } catch (error) { say(error instanceof Error ? error.message : "Could not continue the story interview.", "error"); }
    finally { setInterviewBusy(false); }
  }, [productProfile, settings.productSummary, productMaterials, interviewMaterials, updateStoryStatus, say]);

  const startInterview = useCallback(async (story: StoryOpportunity) => {
    const saved = interviews[story.id];
    setSelectedStoryId(story.id);
    if (saved?.complete) { say("This story interview is already complete. You can continue to drafting.", "info"); return; }
    if (saved?.currentQuestion) { say("Resuming your story interview.", "info"); return; }
    await getNextInterviewQuestion(story, saved?.answers ?? []);
  }, [interviews, getNextInterviewQuestion, say]);

  const answerInterview = useCallback(async (skip = false) => {
    if (!activeStory) return;
    const saved = interviews[activeStory.id];
    if (!saved?.currentQuestion) return;
    if (!skip && !interviewAnswerDraft.trim()) { say("Add an answer or choose Skip question.", "error"); return; }
    const answer: StoryInterviewAnswer = { question: saved.currentQuestion, answer: skip ? "" : interviewAnswerDraft.trim(), skipped: skip, dimension: saved.currentDimension };
    const answers = [...saved.answers, answer];
    setInterviews(prev => ({ ...prev, [activeStory.id]: { ...saved, answers, currentQuestion: undefined, updatedAt: new Date().toISOString() } }));
    await getNextInterviewQuestion(activeStory, answers);
  }, [activeStory, interviews, interviewAnswerDraft, getNextInterviewQuestion, say]);

  const loadDemoWorkspace = useCallback(() => {
    const demoAnalysis: GitHubAnalysis = {
      repository: {
        owner: "bearstouch", name: "trellis", fullName: "bearstouch/trellis", url: "https://github.com/bearstouch/trellis",
        description: "A native macOS terminal workspace with managed windows, tabs, panes, saved SSH hosts and automation.", defaultBranch: "main", language: "Swift", stars: 0, forks: 0, openIssues: 0, updatedAt: "", readme: null,
        topics: ["macos", "swift", "terminal"], dataWarnings: ["This is sample data assembled from specific public issues and PRs; repository metadata was not live-scanned."]
      }, stories: TRELLIS_DEMO_STORIES, scannedAt: new Date().toISOString(), scannedArtifacts: { commits: 0, pullRequests: 4, issues: 1, releases: 1 }
    };
    setSettings(prev => ({ ...prev, repositoryUrl: "https://github.com/bearstouch/trellis", productSummary: "A native macOS terminal workspace with managed windows, tabs, panes, saved SSH hosts and automation." }));
    setAnalysis(demoAnalysis);
    setStories(TRELLIS_DEMO_STORIES.filter(s => !dismissedIds.includes(s.id)));
    setAnalysisMode("demo");
    setSelectedCategory("All categories");
    setSearchQuery("");
    setSelectedStoryId(TRELLIS_DEMO_STORIES[0]?.id ?? null);
    setView("inbox");
    setMobileNavOpen(false);
    setScanError("");
    say("Demo workspace loaded. These examples use public Trellis sources; no live scan was run.", "info");
  }, [dismissedIds, say]);

  const scanRepository = useCallback(async (url?: string, force = false) => {
    const repositoryUrl = (url ?? settings.repositoryUrl).trim();
    if (!repositoryUrl) { setScanError("Add a public GitHub repository URL, or build your Product Profile without a repository."); return; }
    setScanBusy(true); setScanError("");
    try {
      const response = await fetch("/api/github/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl, force, useGitHubApp: Boolean(settings.useGitHubApp) }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not analyze this repository.");
      const loadedAnalysis = data as GitHubAnalysis;
      setSettings(prev => ({ ...prev, repositoryUrl: loadedAnalysis.repository.url }));
      setAnalysis(loadedAnalysis);
      setAnalysisMode("live");
      await findStories(loadedAnalysis.stories);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not analyze this repository.";
      setScanError(message); say(message, "error");
    } finally { setScanBusy(false); }
  }, [settings.repositoryUrl, settings.useGitHubApp, findStories, say]);

  const openStory = (story: StoryOpportunity) => {
    setSelectedStoryId(story.id); setExtraContext(""); setInterviewAnswerDraft(""); setView("story"); setMobileNavOpen(false);
  };
  const dismissStory = (story: StoryOpportunity) => {
    setDismissedIds(prev => [...new Set([...prev, story.id])]);
    setStories(prev => prev.filter(s => s.id !== story.id));
    if (selectedStoryId === story.id) setSelectedStoryId(null);
    say("Story dismissed. Use Find stories again after adding context or sources to refresh opportunities.", "info");
  };

  const openDraftForStory = (story: StoryOpportunity) => {
    setSelectedStoryId(story.id); setCurrentDraftId(null); setDraftText(""); setDraftPlatform("linkedin"); setExtraContext(""); setDraftMode("none"); setDraftReviewWarnings([]); setWritingPreferences({ openingStyle: "ai", closingStyle: "ai" }); setView("draft"); setMobileNavOpen(false);
  };
  const openExistingDraft = (draft: LocalDraft) => {
    setCurrentDraftId(draft.id); setSelectedStoryId(draft.storyId ?? null); setDraftText(draft.text); setDraftPlatform(draft.platform); setDraftMode("none"); setExtraContext(""); setWritingPreferences(draft.writingPreferences ?? { openingStyle: "ai", closingStyle: "ai" }); setDraftReviewWarnings([]); setView("draft"); setMobileNavOpen(false);
  };

  const generateDraft = useCallback(async () => {
    if (!activeStory) { say("Select a story before generating a post.", "error"); return; }
    setDraftBusy(true);
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: activeStory, platform: draftPlatform, voice: settings.writingVoice, extraContext, productProfile, productDescription: settings.productSummary, productAudience: settings.audience, productStage: settings.productStage, materials: materialsForServerRequest([...interviewMaterials, ...productMaterials]), interviewAnswers: interviews[activeStory.id]?.answers ?? [], interviewSummary: interviews[activeStory.id]?.summary ?? "", writingPreferences }), cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate a draft.");
      setDraftText(data.draft); setDraftMode(data.mode); setDraftReviewWarnings(Array.isArray(data.reviewWarnings) ? data.reviewWarnings : []);
      say(data.mode === "ai" ? "AI draft generated. Verify each claim and its linked evidence." : "Grounded template created. Add context or configure OPENAI_API_KEY for AI-assisted drafting.", "success");
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not generate a draft.", "error");
    } finally { setDraftBusy(false); }
  }, [activeStory, draftPlatform, settings, extraContext, productProfile, productMaterials, interviewMaterials, interviews, writingPreferences, say]);

  const saveLocalDraft = () => {
    if (!draftText.trim()) { say("Write or generate a post before saving.", "error"); return; }
    const now = new Date().toISOString();
    const story = activeStory;
    const existing = drafts.find(d => d.id === currentDraftId);
    const saved: LocalDraft = {
      id: currentDraftId ?? crypto.randomUUID(), storyId: story?.id, title: story?.title ?? existing?.title ?? "Untitled draft", text: draftText,
      platform: draftPlatform, category: story?.category ?? existing?.category ?? "New feature shipped", evidence: story?.evidence ?? existing?.evidence ?? [],
      status: existing?.status ?? "local-only", createdAt: existing?.createdAt ?? now, updatedAt: now,
      ...(existing?.bufferPostId ? { bufferPostId: existing.bufferPostId } : {}), ...(existing?.dueAt ? { dueAt: existing.dueAt } : {}), ...(existing?.channelName ? { channelName: existing.channelName } : {}), interviewSummary: activeStory ? interviews[activeStory.id]?.summary : existing?.interviewSummary, writingPreferences
    };
    setDrafts(prev => [saved, ...prev.filter(d => d.id !== saved.id)]); setCurrentDraftId(saved.id);
    if (story) updateStoryStatus(story.id, "drafted");
    say("Draft saved in this browser. It is not yet saved to Buffer.", "success");
  };

  const copyDraft = async () => {
    try { await navigator.clipboard.writeText(draftText); say("Draft copied to clipboard.", "success"); }
    catch { say("Clipboard access failed. Select and copy the post text manually.", "error"); }
  };

  const beginBufferAction = (action: Exclude<BufferAction, null>) => {
    setBufferError("");
    if (!bufferStatus.connected) { setBufferError("Connect Buffer to use this action. Your text remains in Draft Studio."); setBufferAction(action); return; }
    if (!bufferChannels.length) { setBufferError("No Buffer channels are available. Refresh channels or reconnect your Buffer account."); setBufferAction(action); return; }
    setBufferAction(action);
  };

  const confirmBufferAction = async () => {
    if (!bufferAction) return;
    if (!bufferStatus.connected) { say("Connect Buffer before continuing.", "error"); return; }
    if (!selectedChannelId) { setBufferError("Choose a Buffer channel."); return; }
    let dueAt: string | undefined;
    if (bufferAction === "schedule") {
      try { dueAt = localDateTimeToUtc(scheduleDate, scheduleTime, scheduleTimezone); }
      catch (error) { setBufferError(error instanceof Error ? error.message : "Choose a valid date and time."); return; }
      if (Date.parse(dueAt) <= Date.now()) { setBufferError("Choose a time in the future."); return; }
    }
    if (!draftText.trim()) { setBufferError("Post content cannot be empty."); return; }
    setBufferBusy(true); setBufferError("");
    try {
      const response = await fetch("/api/buffer/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: bufferAction, channelId: selectedChannelId, text: draftText, dueAt, schedulingType: scheduleType })
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setBufferStatus(prev => ({ ...prev, connected: false, reconnectRequired: true }));
        throw new Error(data.error || "Buffer could not complete the post action.");
      }
      const story = activeStory;
      const now = new Date().toISOString();
      const existing = drafts.find(d => d.id === currentDraftId);
      const resultStatus: LocalDraft["status"] = bufferAction === "draft" ? "draft" : bufferAction === "schedule" ? "scheduled" : data.post?.status === "sent" ? "published" : "scheduled";
      const saved: LocalDraft = {
        id: currentDraftId ?? crypto.randomUUID(), storyId: story?.id ?? existing?.storyId,
        title: story?.title ?? existing?.title ?? "Releasebuff post", text: draftText, platform: draftPlatform,
        category: story?.category ?? existing?.category ?? "New feature shipped", evidence: story?.evidence ?? existing?.evidence ?? [], status: resultStatus,
        createdAt: existing?.createdAt ?? now, updatedAt: now, bufferPostId: data.post?.id,
        dueAt: data.post?.dueAt ?? dueAt, channelName: selectedChannel?.displayName || selectedChannel?.name
      };
      setDrafts(prev => [saved, ...prev.filter(d => d.id !== saved.id)]); setCurrentDraftId(saved.id);
      if (story) updateStoryStatus(story.id, bufferAction === "publish" ? "published" : "drafted");
      setBufferAction(null);
      const message = bufferAction === "draft" ? "Buffer confirmed the draft was saved." : bufferAction === "schedule" ? "Buffer confirmed the scheduled post." : `Buffer accepted the publish-now request${data.post?.status ? ` (status: ${data.post.status})` : ""}.`;
      say(message, "success");
    } catch (error) {
      setBufferError(error instanceof Error ? error.message : "Buffer could not complete the post action.");
    } finally { setBufferBusy(false); }
  };

  const disconnectBuffer = async () => {
    try {
      const response = await fetch("/api/buffer/disconnect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not disconnect Buffer.");
      setBufferStatus(prev => ({ ...prev, connected: false, account: undefined })); setBufferChannels([]); setSelectedChannelId("");
      say("Buffer session disconnected from Releasebuff. You can revoke the app in Buffer settings if you also want to revoke the grant.", "success");
    } catch (error) { say(error instanceof Error ? error.message : "Could not disconnect Buffer.", "error"); }
  };

  const visibleStories = useMemo(() => stories.filter(story => {
    if (dismissedIds.includes(story.id) || story.status === "dismissed") return false;
    if (selectedCategory !== "All categories" && story.category !== selectedCategory) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && !`${story.title} ${story.summary} ${story.category} ${story.evidence.map(e => e.label).join(" ")}`.toLowerCase().includes(q)) return false;
    return true;
  }), [stories, selectedCategory, searchQuery, dismissedIds]);

  const go = (target: View) => { setView(target); setMobileNavOpen(false); if (target !== "draft") setBufferAction(null); };

  const activeNav = view === "story" ? "inbox" : view;

  return <>
    {view === "landing" ? (
      <LandingPage onGetStarted={() => go("setup")} onTryDemo={loadDemoWorkspace} onSignIn={() => { if (!bufferStatus.connected) navigateToAuthEndpoint("/api/buffer/connect"); else say("Buffer is already connected.", "success"); }} bufferConnected={bufferStatus.connected} bufferConfigured={bufferStatus.configured} />
    ) : (
      <div className="workspace">
        <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
          <Brand onClick={() => go("landing")} />
          <button className="sidebar-project" onClick={() => go("setup")}>
            <span className="project-avatar"><FolderGit2 size={16} /></span>
            <span className="grow"><span className="project-title">{analysis?.repository.name ?? (settings.productName || "Your project")}</span><span className="project-caption">{analysisMode === "demo" ? "Sample workspace" : analysisMode === "live" ? "Optional GitHub evidence" : "Product workspace"}</span></span>
            <ChevronDown size={14} />
          </button>
          <div className="sidebar-section-label">Workspace</div>
          <nav className="sidebar-nav" aria-label="Workspace navigation">
            {navItems.map(item => {
              const Icon = item.icon;
              return <button key={item.view} className={`sidebar-link ${activeNav === item.view ? "active" : ""}`} onClick={() => go(item.view)}><Icon size={16} /><span>{item.label}</span>{item.view === "inbox" && stories.length > 0 && <span className="sidebar-count">{stories.length}</span>}</button>;
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-section-label">Connections</div>
            <button className="sidebar-link" onClick={() => go("setup")}><Github size={16} /><span>GitHub (optional)</span><span className="sidebar-count">{analysis ? "1" : "—"}</span></button>
            <button className="sidebar-link" onClick={() => go("setup")}><Send size={16} /><span>Buffer</span><span className="sidebar-count">{bufferStatus.connected ? "1" : "0"}</span></button>
            <div className="sidebar-user"><span className="user-avatar">RB</span><span className="grow"><span className="user-name">Builder workspace</span><span className="user-plan">Local prototype</span></span><Settings2 size={15} color="#788478" /></div>
          </div>
        </aside>
        {mobileNavOpen && <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,31,21,.25)", zIndex: 70, border: 0 }} />}
        <main className="workspace-main">
          <header className="topbar">
            <div className="row" style={{ minWidth: 0 }}>
              <Button variant="ghost" size="sm" className="mobile-menu button-icon" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation">{mobileNavOpen ? <X size={17} /> : <Menu size={17} />}</Button>
              <div className="breadcrumb"><span className="breadcrumb-hide">Releasebuff</span><ChevronRight size={13} className="breadcrumb-hide" /><strong>{navItems.find(n => n.view === activeNav)?.label ?? "Story details"}</strong></div>
            </div>
            <div className="topbar-actions">
              <span className="connection-pill"><span className={`connection-dot ${bufferStatus.connected ? "live" : ""}`} />{bufferStatus.connected ? "BUFFER CONNECTED" : "BUFFER NOT CONNECTED"}</span>
              <Button variant="lime" size="sm" onClick={() => { if (bufferStatus.connected) go("draft"); else go("setup"); }}>{bufferStatus.connected ? <><Send size={13} /> Buffer ready</> : <><Plus size={13} /> Connect Buffer</>}</Button>
            </div>
          </header>
          {view === "brand" && <BrandKitStudio kit={brandKit} onChange={setBrandKit} />}
          {view === "setup" && <ProjectSetup settings={settings} setSettings={setSettings} analysis={analysis} analysisMode={analysisMode} scanRepository={scanRepository} scanBusy={scanBusy} scanError={scanError} health={health} bufferStatus={bufferStatus} channels={bufferChannels} channelsBusy={channelsBusy} onRefreshChannels={refreshChannels} onConnectBuffer={() => navigateToAuthEndpoint("/api/buffer/connect")} onDisconnectBuffer={disconnectBuffer} onDemo={loadDemoWorkspace} profile={productProfile} materials={productMaterials} onAddMaterial={addProductMaterial} onRemoveMaterial={removeProductMaterial} onBuildProfile={buildProductProfile} profileBusy={profileBusy} onFindStories={findStories} storyDiscoveryBusy={storyDiscoveryBusy} githubStatus={githubStatus} onConnectGitHub={() => { setGithubBusy(true); navigateToAuthEndpoint("/api/github/connect"); }} onDisconnectGitHub={disconnectGitHub} githubBusy={githubBusy} />}
          {view === "inbox" && <StoryInbox analysis={analysis} stories={visibleStories} allCount={stories.filter(s => !dismissedIds.includes(s.id)).length} analysisMode={analysisMode} loading={storyDiscoveryBusy} scanError={scanError} settings={settings} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onFindStories={findStories} canFindStories={Boolean(settings.productName.trim() && settings.productSummary.trim())} onGoSetup={() => go("setup")} onOpenStory={openStory} onDraftStory={openDraftForStory} onDismiss={dismissStory} onShowCategories={() => go("categories")} onDemo={loadDemoWorkspace} />}
          {view === "story" && <StoryDetails story={activeStory} extraContext={extraContext} setExtraContext={setExtraContext} interview={activeInterview} interviewAnswerDraft={interviewAnswerDraft} setInterviewAnswerDraft={setInterviewAnswerDraft} interviewBusy={interviewBusy} onStartInterview={() => activeStory && startInterview(activeStory)} onAnswerInterview={() => answerInterview(false)} onSkipInterview={() => answerInterview(true)} onBack={() => go("inbox")} onDraft={() => activeStory && openDraftForStory(activeStory)} onDismiss={() => activeStory && dismissStory(activeStory)} />}
          {view === "categories" && <StoryCategories stories={stories} onChoose={category => { setSelectedCategory(category); setSearchQuery(""); go("inbox"); }} />}
          {view === "draft" && <DraftStudio story={activeStory} drafts={drafts} currentDraftId={currentDraftId} draftText={draftText} setDraftText={setDraftText} draftPlatform={draftPlatform} setDraftPlatform={setDraftPlatform} draftMode={draftMode} draftBusy={draftBusy} extraContext={extraContext} setExtraContext={setExtraContext} onGenerate={generateDraft} onSaveLocal={saveLocalDraft} onCopy={copyDraft} onBufferAction={beginBufferAction} onBack={() => go(activeStory ? "story" : "inbox")} bufferStatus={bufferStatus} health={health} writingPreferences={writingPreferences} setWritingPreferences={setWritingPreferences} interviewSummary={activeInterview?.summary ?? ""} reviewWarnings={draftReviewWarnings} brandKit={brandKit} productName={settings.productName} />}
          {view === "library" && <DraftLibrary drafts={drafts} search={draftSearch} setSearch={setDraftSearch} filter={draftFilter} setFilter={setDraftFilter} onOpen={openExistingDraft} onDelete={id => { setDrafts(prev => prev.filter(d => d.id !== id)); if (currentDraftId === id) setCurrentDraftId(null); say("Draft removed from this browser.", "success"); }} />}
        </main>
      </div>
    )}
    {bufferAction && view === "draft" && <BufferActionModal action={bufferAction} onClose={() => { setBufferAction(null); setBufferError(""); }} onConfirm={confirmBufferAction} busy={bufferBusy} error={bufferError} connected={bufferStatus.connected} configured={bufferStatus.configured} channels={bufferChannels} channelsBusy={channelsBusy} selectedChannelId={selectedChannelId} setSelectedChannelId={setSelectedChannelId} onConnect={() => navigateToAuthEndpoint("/api/buffer/connect")} onRefreshChannels={refreshChannels} text={draftText} setText={setDraftText} scheduleDate={scheduleDate} setScheduleDate={setScheduleDate} scheduleTime={scheduleTime} setScheduleTime={setScheduleTime} timezone={scheduleTimezone} setTimezone={setScheduleTimezone} scheduleType={scheduleType} setScheduleType={setScheduleType} />}
    {toast && <div className={`toast ${toast.type}`} role="status"><span>{toast.type === "success" ? <CheckCircle2 size={17} /> : toast.type === "error" ? <AlertCircle size={17} /> : <CircleHelp size={17} />}</span><span className="grow">{toast.message}</span><button className="text-button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
  </>;
}


function StoryInbox({ analysis, stories, allCount, analysisMode, loading, scanError, settings, selectedCategory, setSelectedCategory, searchQuery, setSearchQuery, onFindStories, canFindStories, onGoSetup, onOpenStory, onDraftStory, onDismiss, onShowCategories, onDemo }: {
  analysis: GitHubAnalysis | null;
  stories: StoryOpportunity[];
  allCount: number;
  analysisMode: "none" | "demo" | "live";
  loading: boolean;
  scanError: string;
  settings: ProjectPreferences;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onFindStories: () => Promise<void>;
  canFindStories: boolean;
  onGoSetup: () => void;
  onOpenStory: (story: StoryOpportunity) => void;
  onDraftStory: (story: StoryOpportunity) => void;
  onDismiss: (story: StoryOpportunity) => void;
  onShowCategories: () => void;
  onDemo: () => void;
}) {
  const categoryOptions = ["All categories", ...ALL_CATEGORIES.map(category => category.name)];
  const readyCount = stories.filter(story => story.status === "ready-to-draft" || story.status === "new").length;
  const evidenceCount = stories.filter(story => story.evidence.length > 0).length;
  const repository = analysis?.repository;

  return <div className="workspace-content">
    <div className="page-heading">
      <div>
        <span className="eyebrow">RBF.01 / DISCOVER</span>
        <h1>Story Inbox</h1>
        <p>Find the meaningful stories inside your product journey. Each opportunity should connect to real evidence or clearly show where your perspective is needed.</p>
      </div>
      <div className="heading-actions">
        <Button variant="outline" onClick={onGoSetup}><Settings2 size={14}/> Product intelligence</Button>
      </div>
    </div>

    <section className="panel" style={{ marginBottom: 17, borderColor: "#c9d9c5", background: "linear-gradient(115deg, #f0f6e8 0%, #ffffff 68%)" }}>
      <div className="panel-body row wrap" style={{ padding: 22, alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: "1 1 420px", minWidth: 0 }}>
          <span className="feature-icon" style={{ width: 46, height: 46, margin: 0, flexShrink: 0 }}><BrainCircuit size={22}/></span>
          <div className="grow">
            <span className="eyebrow">PRODUCT INTELLIGENCE / STORY DISCOVERY</span>
            <h2 style={{ margin: "5px 0 7px", fontSize: 23, letterSpacing: "-.04em", lineHeight: 1.1, color: "var(--forest)" }}>Find stories worth sharing</h2>
            <p className="context-copy" style={{ maxWidth: 700, margin: 0 }}>Combine your Product Intelligence Profile, product details, notes, documents and screenshots. GitHub can add context, but you can find stories without connecting a repository.</p>
            <div className="row wrap small muted" style={{ marginTop: 10, gap: 7 }}><Badge>Product profile</Badge><Badge>Builder notes & documents</Badge><Badge>GitHub optional</Badge></div>
          </div>
        </div>
        <Button variant="lime" onClick={onFindStories} disabled={loading || !canFindStories} style={{ minHeight: 48, padding: "14px 22px", fontSize: 14, flexShrink: 0 }}>{loading ? <LoaderCircle size={16} className="spinning"/> : <Sparkles size={16}/>} {loading ? "Finding stories…" : "Find stories"} <ArrowRight size={15}/></Button>
      </div>
    </section>

    {scanError && <div className="alert alert-error" role="alert"><AlertCircle size={16}/><span>{scanError}</span></div>}

    {repository ? <section className="panel" style={{ marginBottom: 17 }}>
      <div className="panel-body row wrap">
        <span className="feature-icon" style={{ margin: 0 }}><Github size={18}/></span>
        <div className="grow">
          <div style={{ fontWeight: 800, color: "var(--forest)", fontSize: 13 }}>{repository.fullName}</div>
          <div className="small muted">{repository.description || "Repository connected for development-story discovery."}</div>
          <div className="row wrap small muted" style={{ marginTop: 6, gap: 10 }}>
            <span>{repository.language || "Language not detected"}</span><span>·</span><span>{repository.stars} stars</span><span>·</span><span>Scanned {fmtDate(analysis?.scannedAt ?? "")}</span>
            {analysisMode === "demo" && <Badge>Sample data</Badge>}
          </div>
        </div>
        <a className="button button-outline button-sm" href={repository.url} target="_blank" rel="noreferrer">View repository <ExternalLink size={12}/></a>
      </div>
      {repository.dataWarnings.length > 0 && <div className="panel-body" style={{ paddingTop: 0 }}><div className="alert alert-info"><CircleHelp size={15}/><div><strong>Source notes</strong><ul style={{ margin: "5px 0 0", paddingLeft: 18 }}>{repository.dataWarnings.slice(0, 3).map((warning, i) => <li key={i}>{warning}</li>)}</ul></div></div></div>}
    </section> : <section className="panel" style={{ marginBottom: 17 }}>
      <div className="panel-body row wrap">
        <span className="feature-icon" style={{ margin: 0 }}><Github size={18}/></span>
        <div className="grow">
          <div style={{ fontWeight: 800, color: "var(--forest)", fontSize: 13 }}>GitHub evidence is optional</div>
          <div className="small muted">{settings.productName ? `${settings.productName} · ` : ""}Add a repository when you want development activity to supplement your Product Intelligence Profile. You can find stories without connecting GitHub.</div>
        </div>
        <Button variant="outline" onClick={onGoSetup}>Set up your product <ArrowRight size={13}/></Button>
      </div>
    </section>}

    <div className="stats-row">
      <div className="stat-card"><div className="stat-number">{allCount}</div><div className="stat-label">Story opportunities</div></div>
      <div className="stat-card"><div className="stat-number">{readyCount}</div><div className="stat-label">Ready to explore</div></div>
      <div className="stat-card"><div className="stat-number">{evidenceCount}</div><div className="stat-label">With evidence</div></div>
      <div className="stat-card"><div className="stat-number">{Math.max(0, allCount - evidenceCount)}</div><div className="stat-label">Need context</div></div>
    </div>

    <div className="filter-row">
      <div className="search-wrap"><Search size={15}/><input className="input" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search stories and evidence…" aria-label="Search story inbox"/></div>
      <select className="select filter-select" value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)} aria-label="Filter by story category">{categoryOptions.map(option => <option value={option} key={option}>{option}</option>)}</select>
      <Button variant="outline" size="sm" onClick={onShowCategories}><Tag size={13}/> Browse categories</Button>
    </div>

    {stories.length ? <div className="story-list">{stories.map(story => <StoryCard key={story.id} story={story} onOpen={() => onOpenStory(story)} onDraft={() => onDraftStory(story)} onDismiss={() => onDismiss(story)}/>)}</div> : <div className="empty-state">
      <div className="empty-icon">{loading ? <LoaderCircle className="spinning" size={22}/> : <Layers3 size={22}/>}</div>
      <h3>{loading ? "Combining your product context…" : allCount ? "No stories match these filters" : analysisMode === "none" ? "Let's find your first story" : "No useful stories found yet"}</h3>
      <p>{loading ? "Releasebuff is combining your Product Intelligence Profile, product details, notes, documents and optional GitHub evidence." : allCount ? "Try another search term or category. You can also browse the full set of story categories." : analysisMode === "none" ? "Add your product details, notes, documents, or screenshots. A repository is optional; start with whatever context you have." : "The available sources did not produce a useful story yet. Add more product context or update your materials and try again."}</p>
      <div className="row wrap" style={{ justifyContent: "center" }}>
        {!loading && <Button variant="lime" onClick={onGoSetup}>{analysisMode === "none" ? "Set up product sources" : "Add more evidence"} <ArrowRight size={13}/></Button>}
        {!loading && canFindStories && <Button variant="lime" onClick={onFindStories}><Sparkles size={13}/> Find stories</Button>}
        {!loading && analysisMode === "none" && <Button variant="outline" onClick={onDemo}><Eye size={13}/> Explore sample stories</Button>}
      </div>
    </div>}
    <div className="row-between small muted" style={{ marginTop: 14, gap: 12 }}><span>Source-backed stories take priority over generic prompts.</span><span>{stories.length} shown</span></div>
  </div>;
}

function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="row-between" style={{ gap: 12 }}>
    <span className="small muted">{label}</span>
    <span className="row" style={{ gap: 6, justifyContent: "flex-end", textAlign: "right" }}>
      {ok ? <CheckCircle2 size={13} color="#528541"/> : <AlertCircle size={13} color="#9a772c"/>}
      <span className="small" style={{ color: ok ? "var(--forest)" : "var(--ink-muted)" }}>{value}</span>
    </span>
  </div>;
}

function LandingPage({ onGetStarted, onTryDemo, onSignIn, bufferConnected, bufferConfigured }: { onGetStarted: () => void; onTryDemo: () => void; onSignIn: () => void; bufferConnected: boolean; bufferConfigured: boolean }) {
  return <div className="app-shell">
    <nav className="public-nav"><Brand onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} /><div className="public-nav-links"><button className="text-button" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>How it works</button><button className="text-button" onClick={() => document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" })}>Story types</button><Button variant="outline" size="sm" onClick={onSignIn}>{bufferConnected ? <CheckCircle2 size={14} /> : <LockKeyhole size={14} />}{bufferConnected ? "Buffer connected" : "Sign in with Buffer"}</Button><Button variant="lime" size="sm" onClick={onGetStarted}>Get started <ArrowRight size={14} /></Button></div></nav>
    <section className="hero">
      <div className="hero-copy"><span className="badge"><span className="connection-dot live" /> FOR BUILDERS BUILDING IN PUBLIC</span><h1 className="hero-title">Build the product. Find the story worth sharing.</h1><p className="hero-description">Releasebuff helps you turn product decisions, experiments, customer conversations and progress into authentic stories, then create a branded visual for review before publishing. GitHub is optional.</p><div className="hero-actions"><Button variant="lime" onClick={onGetStarted}>Find your first story <ArrowRight size={16} /></Button><Button variant="outline" onClick={onTryDemo}><Eye size={15} /> Explore the agent</Button></div><div className="hero-proof"><span className="hero-proof-dot" /> Evidence-backed story ideas <span>·</span> Human-approved publishing</div></div>
      <div className="hero-window" aria-label="Product preview illustration"><div className="hero-window-top"><span className="window-dot"/><span className="window-dot"/><span className="window-dot"/><span className="hero-window-title">releasebuff / story-inbox</span><span style={{ marginLeft: "auto" }}><span className="badge badge-success">PREVIEW</span></span></div><div className="hero-preview-body"><aside className="preview-nav"><div className="preview-nav-label">WORKSPACE</div><div className="preview-nav-item active"><Layers3 size={12}/>Story Inbox</div><div className="preview-nav-item"><Tag size={12}/>Categories</div><div className="preview-nav-item"><FileText size={12}/>Draft Studio</div><div className="preview-nav-item"><BookMarked size={12}/>Draft Library</div><div className="preview-nav-item"><Settings2 size={12}/>Project Setup</div></aside><div className="preview-content"><div className="eyebrow">RBF.01 / DISCOVER</div><div className="preview-content-title hero-preview-heading" style={{ marginTop: 8 }}>Your Story Inbox</div><div className="preview-meta">SAMPLE PROJECT: TRELLIS</div><div className="preview-stat-row"><div className="preview-stat hero-stat-in"><div className="preview-stat-value">16</div><div className="preview-stat-label">STORY TYPES</div></div><div className="preview-stat hero-stat-in"><div className="preview-stat-value">4</div><div className="preview-stat-label">GROUPS</div></div><div className="preview-stat hero-stat-in"><div className="preview-stat-value">↗</div><div className="preview-stat-label">SOURCE LINKS</div></div></div><div className="preview-story hero-story-in"><div className="preview-story-top"><span className="badge badge-success">PRODUCT DECISION</span><span className="badge">BUILDER NOTE</span></div><div className="preview-story-title">We removed a feature to simplify the core workflow</div><div className="preview-story-description">The decision started with a simple question: what should be easiest for a new user to do?</div><div className="preview-story-footer"><span>Evidence-backed</span><span>Review story →</span></div></div><div className="preview-story hero-story-in"><div className="preview-story-top"><span className="badge badge-warning">CUSTOMER INSIGHT</span><span className="badge">INTERVIEW</span></div><div className="preview-story-title">Feedback raised a question worth investigating</div><div className="preview-story-description">The next step is to understand what the person was trying to accomplish before choosing a solution.</div><div className="preview-story-footer"><span>Issue + fix</span><span>Inspect →</span></div></div></div></div></div>
    </section>
    <section className="marketing-section" id="how-it-works" style={{ background: "#fff" }}><div className="marketing-inner"><span className="eyebrow">HOW IT WORKS</span><h2 className="section-title">From development work to a story worth sharing.</h2><p className="section-lede">You keep building. Releasebuff helps you notice meaningful moments, combine product context with evidence, and turn them into posts and branded visuals that sound like you.</p><div className="feature-grid"><div className="feature-card"><IconBox icon={Github}/><span className="eyebrow">01 / ADD PROJECT</span><h3>Start wherever you are</h3><p>Start with a description of your product and what you are trying to achieve. Add notes, documents, screenshots or public URLs; connect GitHub only if development evidence would help.</p></div><div className="feature-card"><IconBox icon={WandSparkles}/><span className="eyebrow">02 / DISCOVER</span><h3>Find the story</h3><p>Combine the Product Intelligence Profile, founder context, notes, documents and optional connected tools to find story opportunities worth exploring.</p></div><div className="feature-card"><IconBox icon={Send}/><span className="eyebrow">03 / DRAFT</span><h3>Draft + visual together</h3><p>Create a platform-appropriate post and a matching branded graphic or GIF in the same workflow. Edit each independently, then choose whether to save, schedule or publish through Buffer.</p></div></div></div></section>
    <section className="marketing-section" id="stories"><div className="marketing-inner"><span className="eyebrow">STORY CATEGORIES</span><h2 className="section-title">More than “I shipped a feature.”</h2><p className="section-lede">Your experience is the source of stories. The agent looks across product progress, lessons, product marketing and audience growth—and asks for context instead of guessing. GitHub can add supporting evidence.</p><div className="feature-grid">{CATEGORY_GROUPS.map(group => { const Icon = groupIcon[group.name]; return <div className="feature-card" key={group.name}><IconBox icon={Icon}/><h3>{group.name}</h3><p>{group.tagline}. Includes {group.categories.slice(0, 3).map(c => c.name.toLowerCase()).join(", ")} and more.</p></div>; })}</div></div></section>
    <section className="marketing-section"><div className="marketing-inner"><div className="future-band"><div><span className="eyebrow" style={{ color: "#c9fa78" }}>ONE SHARED PRODUCT MEMORY</span><h3 style={{ marginTop: 9 }}>Keep the context behind every story.</h3><p>Your Product Intelligence Profile brings together product details, notes, experiments and founder interviews. GitHub can add implementation context later, but the story workflow works without it.</p></div><Button variant="lime" onClick={onGetStarted}>Start with product context <ArrowRight size={14}/></Button></div></div></section>
    <footer className="public-footer"><span>© {new Date().getFullYear()} Releasebuff</span><span>Grounded in evidence. Written with the builder.</span><a href="/privacy">Privacy Policy</a>{!bufferConfigured && <span>Buffer publishing setup required</span>}</footer>
  </div>;
}

function ProjectSetup({ settings, setSettings, analysis, analysisMode, scanRepository, scanBusy, scanError, health, bufferStatus, channels, channelsBusy, onRefreshChannels, onConnectBuffer, onDisconnectBuffer, onDemo, profile, materials, onAddMaterial, onRemoveMaterial, onBuildProfile, profileBusy, onFindStories, storyDiscoveryBusy, githubStatus, onConnectGitHub, onDisconnectGitHub, githubBusy }: {
  settings: ProjectPreferences; setSettings: React.Dispatch<React.SetStateAction<ProjectPreferences>>; analysis: GitHubAnalysis | null; analysisMode: "none" | "demo" | "live";
  scanRepository: (url?: string, force?: boolean) => Promise<void>; scanBusy: boolean; scanError: string; health: { aiConfigured: boolean; claudeGifConfigured?: boolean; bufferConfigured: boolean; githubAppConfigured?: boolean; encryptedIntegrationStore?: boolean } | null;
  bufferStatus: BufferStatus; channels: BufferChannel[]; channelsBusy: boolean; onRefreshChannels: () => Promise<void>; onConnectBuffer: () => void; onDisconnectBuffer: () => void; onDemo: () => void;
  profile: ProductProfile | null; materials: ProductMaterial[]; onAddMaterial: (material: ProductMaterial) => void; onRemoveMaterial: (id: string) => void; onBuildProfile: () => Promise<void>; profileBusy: boolean; onFindStories: () => Promise<void>; storyDiscoveryBusy: boolean;
  githubStatus: { connected: boolean; configured: boolean }; onConnectGitHub: () => void; onDisconnectGitHub: () => void; githubBusy: boolean;
}) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const toggleGoal = (goal: string) => setSettings(prev => ({ ...prev, goals: prev.goals.includes(goal) ? prev.goals.filter(g => g !== goal) : [...prev.goals, goal] }));

  const addUrlSource = async () => {
    if (!sourceUrl.trim()) return;
    setSourceBusy(true); setSourceError("");
    try {
      const response = await fetch("/api/sources/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sourceUrl.trim() }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add this public source.");
      const url = String(data.url);
      onAddMaterial({ id: crypto.randomUUID(), kind: "url", title: new URL(url).hostname + new URL(url).pathname, sourceUrl: url, mimeType: data.contentType, textContent: String(data.text), addedAt: new Date().toISOString(), collectedAt: data.collectedAt, sourceStatus: "fetched" });
      setSourceUrl("");
    } catch (error) { setSourceError(error instanceof Error ? error.message : "Could not add this public source."); }
    finally { setSourceBusy(false); }
  };

  const addUploadedFile = async (file?: File) => {
    if (!file) return;
    setSourceError("");
    if (file.size > 4_000_000) { setSourceError("Keep each upload under 4 MB for local-first storage and AI requests."); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImage = file.type.startsWith("image/") && ["png", "jpeg", "jpg", "webp"].includes(extension);
    const isPdf = file.type === "application/pdf" || extension === "pdf";
    const isText = ["txt", "md", "mdx", "json", "csv", "html", "xml"].includes(extension) || file.type.startsWith("text/") || file.type === "application/json";
    if (!isImage && !isPdf && !isText) { setSourceError("Supported uploads: PDF, PNG/JPG/WebP screenshots, TXT, Markdown, JSON and CSV. For DOCX, export to PDF or paste the relevant text."); return; }
    try {
      let dataUrl: string | undefined;
      let textContent: string | undefined;
      if (isText) textContent = (await file.text()).slice(0, 30_000);
      else dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read file.")); reader.onerror = () => reject(new Error("Could not read file.")); reader.readAsDataURL(file);
      });
      onAddMaterial({ id: crypto.randomUUID(), kind: isImage ? "screenshot" : "document", title: file.name, mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"), textContent, dataUrl, addedAt: new Date().toISOString(), sourceStatus: "user-provided" });
    } catch (error) { setSourceError(error instanceof Error ? error.message : "Could not read this file."); }
  };

  const addBuilderNote = () => {
    if (!noteText.trim()) return;
    onAddMaterial({ id: crypto.randomUUID(), kind: "note", title: noteTitle.trim() || "Builder note", textContent: noteText.trim().slice(0, 12_000), addedAt: new Date().toISOString(), sourceStatus: "user-provided" });
    setNoteTitle(""); setNoteText("");
  };

  return <div className="workspace-content">
    <div className="page-heading"><div><span className="eyebrow">RBF.01 / PRODUCT UNDERSTANDING</span><h1>Let&apos;s get to know your product.</h1><p>Tell us what you&apos;re building, then add whatever evidence you have. A live website or repository is not required to get started.</p></div><div className="heading-actions"><Button variant="outline" onClick={onDemo}><Eye size={14}/> Load sample project</Button><Button variant="outline" onClick={onBuildProfile} disabled={profileBusy || !settings.productName.trim() || !settings.productSummary.trim()}>{profileBusy ? <LoaderCircle className="spinning" size={14}/> : <BrainCircuit size={14}/>} {profileBusy ? "Understanding product…" : "Build Product Profile"}</Button><Button variant="lime" onClick={onFindStories} disabled={storyDiscoveryBusy || !settings.productName.trim() || !settings.productSummary.trim()}>{storyDiscoveryBusy ? <LoaderCircle className="spinning" size={14}/> : <Sparkles size={14}/>} {storyDiscoveryBusy ? "Finding stories…" : "Find stories"}</Button></div></div>
    <div className="setup-grid">
      <div className="stack">
        <section className="panel">
          <div className="panel-header"><div className="row"><BrainCircuit size={18}/><span className="panel-title">Tell us about your product</span></div><Badge tone={settings.productName.trim() && settings.productSummary.trim() ? "success" : "neutral"}>{settings.productName.trim() && settings.productSummary.trim() ? "Ready to analyze" : "Two required fields"}</Badge></div>
          <div className="panel-body form-stack">
            <div><label className="form-label" htmlFor="productName">Product name *</label><input id="productName" className="input" value={settings.productName} onChange={e => setSettings(prev => ({ ...prev, productName: e.target.value }))} placeholder="What are you building?" maxLength={120}/></div>
            <div><label className="form-label" htmlFor="productSummary">What are you building? *</label><textarea className="textarea" id="productSummary" style={{ minHeight: 112 }} value={settings.productSummary} onChange={e => setSettings(prev => ({ ...prev, productSummary: e.target.value }))} placeholder="Describe your product in your own words. What does it help someone do, and what problem are you trying to solve?" maxLength={4000}/><div className="form-help">This can be an idea, prototype, or launched product. It does not need to sound like marketing copy.</div></div>
            <div className="form-row"><div><label className="form-label" htmlFor="audience">Who is it built for? (optional)</label><input id="audience" className="input" value={settings.audience} onChange={e => setSettings(prev => ({ ...prev, audience: e.target.value }))} placeholder="e.g. indie developers"/></div><div><label className="form-label" htmlFor="productStage">Building stage</label><select id="productStage" className="select" value={settings.productStage} onChange={e => setSettings(prev => ({ ...prev, productStage: e.target.value as ProjectPreferences["productStage"] }))}><option value="idea">Exploring an idea</option><option value="prototype">Building a prototype</option><option value="actively-building">Actively building</option><option value="early-launch">Launched an early version</option><option value="established">Established product</option></select></div></div>
            <div><label className="form-label" htmlFor="websiteUrl">Product website (optional)</label><input id="websiteUrl" className="input" value={settings.websiteUrl} onChange={e => setSettings(prev => ({ ...prev, websiteUrl: e.target.value }))} placeholder="https://yourproduct.com"/><div className="form-help">You can add a website to the source library below. No website yet? Keep going.</div></div>
            <div><label className="form-label" htmlFor="voice">Default writing voice</label><select className="select" id="voice" value={settings.writingVoice} onChange={e => setSettings(prev => ({ ...prev, writingVoice: e.target.value }))}><option>Natural and specific</option><option>Technical and thoughtful</option><option>Casual and conversational</option><option>Direct and concise</option></select></div>
            <div><span className="form-label">What are you hoping to achieve?</span><div className="stack" style={{ gap: 8 }}>{["Grow an audience", "Attract users and customers", "Build credibility in my field", "Get feedback and early adopters"].map(goal => <label key={goal} className="row" style={{ alignItems: "flex-start", gap: 9, fontSize: 12, color: "var(--ink-muted)" }}><input type="checkbox" checked={settings.goals.includes(goal)} onChange={() => toggleGoal(goal)} style={{ marginTop: 2, accentColor: "var(--forest)" }}/><span>{goal}</span></label>)}</div></div>
            <div className="row wrap"><Button variant="lime" onClick={onBuildProfile} disabled={profileBusy || !settings.productName.trim() || !settings.productSummary.trim()}>{profileBusy ? <LoaderCircle size={14} className="spinning"/> : <Sparkles size={14}/>} {profileBusy ? "Building…" : "Understand my product"}</Button><span className="small muted">Saved in this browser with IndexedDB.</span></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div className="row"><Github size={18}/><span className="panel-title">GitHub · Optional development evidence</span></div><Badge tone={githubStatus.connected || analysis ? "success" : "neutral"}>{githubStatus.connected ? "Connected" : analysis ? "Repository added" : "Optional"}</Badge></div>
          <div className="panel-body form-stack">
            <p className="context-copy">Connect GitHub to let Releasebuff review relevant development activity, understand what changed, and find stories worth sharing. For a private repository, install the GitHub App and choose the repositories it can access.</p>
            <div><label className="form-label" htmlFor="repositoryUrl">GitHub repository URL</label><div className="repo-bar"><input id="repositoryUrl" className="input" value={settings.repositoryUrl} onChange={e => setSettings(prev => ({ ...prev, repositoryUrl: e.target.value }))} placeholder="https://github.com/owner/repository"/><Button onClick={() => scanRepository()} disabled={scanBusy || !settings.repositoryUrl.trim()}>{scanBusy ? <LoaderCircle size={14} className="spinning"/> : <Search size={14}/>} Scan repository</Button></div><div className="form-help">GitHub is optional. Scanning adds repository evidence to your workspace, but Find stories combines that evidence with the Product Intelligence Profile, builder notes, documents and product details. For a private repository, connect GitHub and select the repository during installation.</div></div>
            <label className="row small" style={{ gap: 9, alignItems: "flex-start" }}><input type="checkbox" checked={Boolean(settings.useGitHubApp)} onChange={e => setSettings(prev => ({ ...prev, useGitHubApp: e.target.checked }))} style={{ marginTop: 2, accentColor: "var(--forest)" }}/><span>Use my connected GitHub App installation to scan this repository (private or explicitly selected repository).</span></label>
            <div className="row wrap"><Button variant="lime" onClick={onConnectGitHub} disabled={!githubStatus.configured || githubBusy}>{githubBusy ? <LoaderCircle size={14} className="spinning"/> : <Github size={14}/>} {githubStatus.connected ? "Manage GitHub installation" : "Connect GitHub"}</Button>{githubStatus.connected && <Button variant="outline" onClick={onDisconnectGitHub}><LogOut size={14}/> Disconnect</Button>}<span className="small muted">Read-only repository access.</span></div>
            {!githubStatus.configured && <div className="alert alert-warning"><AlertCircle size={15}/><span>GitHub App credentials aren&apos;t configured yet. Public URL scanning works now. Add GITHUB_APP_ID, GITHUB_APP_SLUG and GITHUB_APP_PRIVATE_KEY when you are ready to test private repositories.</span></div>}
            {scanError && <div className="alert alert-error"><AlertCircle size={16}/><span>{scanError}</span></div>}
            {analysis?.repository && <div className="alert alert-success"><CheckCircle2 size={16}/><div><strong>{analysis.repository.fullName}</strong><br/><span>{analysis.repository.description || "No repository description supplied."}</span><br/><span className="small">{analysis.repository.language || "Language not detected"}{analysis.scannedAt ? ` · Last scanned ${fmtDate(analysis.scannedAt)}` : ""}</span></div></div>}
            {analysis && analysisMode === "live" && <div className="stats-row" style={{ marginBottom: 0 }}><div className="stat-card"><div className="stat-number">{analysis.scannedArtifacts.pullRequests}</div><div className="stat-label">PRs scanned</div></div><div className="stat-card"><div className="stat-number">{analysis.scannedArtifacts.issues}</div><div className="stat-label">Issues scanned</div></div><div className="stat-card"><div className="stat-number">{analysis.scannedArtifacts.commits}</div><div className="stat-label">Commits scanned</div></div><div className="stat-card"><div className="stat-number">{analysis.stories.length}</div><div className="stat-label">Story ideas</div></div></div>}
            {analysis?.repository.dataWarnings.map(w => <div className="alert alert-warning" key={w}><AlertCircle size={15}/><span>{w}</span></div>)}
            <div className="alert alert-info"><RefreshCw size={16}/><span><strong>Automatic GitHub monitoring — planned for a later phase.</strong> In this version, scan manually to refresh development evidence.</span></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div className="row"><FilesIcon/><span className="panel-title">Add product evidence</span></div><Badge>{materials.length} source{materials.length === 1 ? "" : "s"}</Badge></div>
          <div className="panel-body form-stack">
            <div><label className="form-label" htmlFor="sourceUrl">Public documentation, changelog or demo URL</label><div className="repo-bar"><input id="sourceUrl" className="input" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://docs.yourproduct.com or /changelog"/><Button onClick={addUrlSource} disabled={sourceBusy || !sourceUrl.trim()}>{sourceBusy ? <LoaderCircle size={14} className="spinning"/> : <Plus size={14}/>} Add URL</Button></div><div className="form-help">Releasebuff fetches readable text from public HTTPS pages and keeps the source URL with the extracted content.</div></div>
            <div><label className="form-label" htmlFor="sourceFile">Upload a PRD, notes, or screenshot</label><input id="sourceFile" className="input" type="file" accept=".pdf,.txt,.md,.mdx,.json,.csv,.html,.xml,.png,.jpg,.jpeg,.webp" onChange={e => { void addUploadedFile(e.target.files?.[0]); e.currentTarget.value = ""; }}/><div className="form-help">Original uploads stay in this browser. When you ask Releasebuff to build a profile, discover stories or draft content, relevant text and at most one small PDF/screenshot are sent to the configured OpenAI API. Limit: 4 MB per file; smaller visuals are more likely to be included in an AI request.</div></div>
            <div className="form-row"><div><label className="form-label" htmlFor="noteTitle">Note title</label><input id="noteTitle" className="input" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Why I'm building this"/></div><div className="row" style={{ alignItems: "end" }}><Button variant="outline" onClick={addBuilderNote} disabled={!noteText.trim()}><Plus size={14}/> Add note</Button></div></div>
            <div><label className="form-label" htmlFor="noteText">PRD excerpt, product note, or builder context</label><textarea id="noteText" className="textarea" rows={4} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Paste relevant requirements, feature details, decisions, or context here…"/></div>
            {sourceError && <div className="alert alert-error"><AlertCircle size={15}/><span>{sourceError}</span></div>}
            {materials.length > 0 && <div className="stack" style={{ gap: 8, marginTop: 4 }}>{materials.map(material => <div className="library-row" key={material.id}><span className="feature-icon" style={{ margin: 0 }}><FileText size={16}/></span><div className="library-row-main"><div className="row wrap"><strong style={{ fontSize: 12 }}>{material.title}</strong><Badge tone={material.sourceStatus === "fetched" ? "success" : "neutral"}>{material.kind}</Badge></div><div className="small muted">{material.sourceUrl || material.mimeType || "Builder-provided"} · Added {fmtDate(material.addedAt)}</div>{material.error && <div className="small">{material.error}</div>}</div><Button variant="ghost" size="sm" onClick={() => onRemoveMaterial(material.id)} aria-label={`Remove ${material.title}`}><Trash2 size={13}/></Button></div>)}</div>}
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="panel">
          <div className="panel-header"><div className="row"><BrainCircuit size={17}/><span className="panel-title">Product Intelligence Profile</span></div><Badge tone={profile ? "success" : "neutral"}>{profile ? "Created" : "Not created"}</Badge></div>
          <div className="panel-body stack">
            {!profile ? <><p className="context-copy">Your profile combines your description, source material and confirmed answers. Build it when you&apos;re ready; Releasebuff will identify what it still needs to learn.</p><Button className="button-block" variant="lime" onClick={onBuildProfile} disabled={profileBusy || !settings.productName.trim() || !settings.productSummary.trim()}>{profileBusy ? <LoaderCircle size={14} className="spinning"/> : <Sparkles size={14}/>} Create Product Profile</Button></> : <>
              <div><div className="eyebrow">PRODUCT</div><h3 style={{ margin: "5px 0 4px", color: "var(--forest)" }}>{profile.productName}</h3><p className="context-copy">{profile.oneLineDescription}</p></div>
              {profile.problem && <div><div className="context-heading">Problem</div><p className="small" style={{ lineHeight: 1.65 }}>{profile.problem}</p></div>}
              {profile.targetAudience && <div><div className="context-heading">Intended audience</div><p className="small">{profile.targetAudience}</p></div>}
              {profile.valueProposition && <div><div className="context-heading">Value proposition</div><p className="small" style={{ lineHeight: 1.65 }}>{profile.valueProposition}</p></div>}
              {profile.capabilities?.length > 0 && <div><div className="context-heading">Known capabilities</div><ul className="small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>{profile.capabilities.map((x,i) => <li key={i}>{x}</li>)}</ul></div>}
              {profile.unknowns?.length > 0 && <div className="alert alert-warning"><CircleHelp size={15}/><div><strong>Still to clarify</strong><ul style={{ paddingLeft: 18, margin: "5px 0 0", lineHeight: 1.65 }}>{profile.unknowns.slice(0,5).map((x,i) => <li key={i}>{x}</li>)}</ul></div></div>}
              <div className="small muted">Last updated {fmtDate(profile.updatedAt)} · {profile.generatedBy === "ai" ? "AI-assisted analysis" : "Local summary"}</div>
              <Button variant="outline" className="button-block" onClick={onBuildProfile} disabled={profileBusy}>{profileBusy ? <LoaderCircle size={14} className="spinning"/> : <RefreshCw size={14}/>} Refresh understanding</Button>
            </>}
          </div>
        </section>
        <section className="panel"><div className="panel-header"><span className="panel-title">Publishing through Buffer</span><Badge tone={bufferStatus.connected ? "success" : "neutral"}>{bufferStatus.connected ? "Connected" : "Not connected"}</Badge></div><div className="panel-body stack">
          <div className="row"><span className="feature-icon" style={{ margin: 0 }}><Send size={18}/></span><div className="grow"><div style={{ fontSize: 13, fontWeight: 800 }}>Buffer</div><div className="small muted">Save drafts, schedule and publish posts.</div></div></div>
          {bufferStatus.connected ? <><div className="alert alert-success"><CheckCircle2 size={16}/><span>Connected{bufferStatus.account?.email ? ` as ${bufferStatus.account.email}` : ""}. Access tokens stay server-side.</span></div><div className="small muted">{channels.length} channel{channels.length === 1 ? "" : "s"} available</div><Button variant="outline" onClick={onRefreshChannels} disabled={channelsBusy}>{channelsBusy ? <LoaderCircle size={14} className="spinning"/> : <RefreshCw size={14}/>} Refresh channels</Button><Button variant="ghost" onClick={onDisconnectBuffer}><LogOut size={14}/> Disconnect Buffer session</Button></> : <><p className="small muted" style={{ lineHeight: 1.65, margin: 0 }}>Connect Buffer when you&apos;re ready to send reviewed posts to your channels. OAuth must be configured before live publishing works.</p><Button variant="lime" onClick={onConnectBuffer} disabled={!bufferStatus.configured}><LockKeyhole size={14}/> Connect Buffer</Button>{!bufferStatus.configured && <div className="alert alert-warning"><AlertCircle size={15}/><span>Configure BUFFER_CLIENT_ID, BUFFER_CLIENT_SECRET, BUFFER_REDIRECT_URI and SESSION_ENCRYPTION_KEY in .env.local. Production uses Netlify Blobs.</span></div>}</>}
        </div></section>
        <section className="panel"><div className="panel-header"><span className="panel-title">System status</span><Badge>{health ? "Checked" : "Checking"}</Badge></div><div className="panel-body stack" style={{ gap: 9 }}><StatusLine label="Public GitHub analysis" value="Available" ok/><StatusLine label="GitHub App" value={githubStatus.configured ? "Configured" : "Needs credentials"} ok={githubStatus.configured}/><StatusLine label="OpenAI" value={health?.aiConfigured ? "Configured" : "Fallback mode"} ok={Boolean(health?.aiConfigured)}/><StatusLine label="Claude GIF storyboard" value={health?.claudeGifConfigured ? "Configured" : "Fallback mode"} ok={Boolean(health?.claudeGifConfigured)}/><StatusLine label="Buffer OAuth" value={bufferStatus.configured ? "Configured" : "Needs credentials"} ok={bufferStatus.configured}/><StatusLine label="Integration storage" value={health?.encryptedIntegrationStore ? (process.env.NODE_ENV === "production" ? "Configured" : "Local encrypted fallback") : "Check configuration"} ok={Boolean(health?.encryptedIntegrationStore)}/></div></section>
      </div>
    </div>
  </div>;
}
function FilesIcon() { return <FileUp size={17}/>; }

function StoryDetails({ story, extraContext, setExtraContext, interview, interviewAnswerDraft, setInterviewAnswerDraft, interviewBusy, onStartInterview, onAnswerInterview, onSkipInterview, onBack, onDraft, onDismiss }: {
  story: StoryOpportunity | null; extraContext: string; setExtraContext: (v: string) => void; interview: StoryInterview | null; interviewAnswerDraft: string; setInterviewAnswerDraft: (v: string) => void; interviewBusy: boolean; onStartInterview: () => void; onAnswerInterview: () => void; onSkipInterview: () => void; onBack: () => void; onDraft: () => void; onDismiss: () => void;
}) {
  if (!story) return <div className="workspace-content"><div className="empty-state"><div className="empty-icon"><FileSearchIcon/></div><h3>No story selected</h3><p>Choose a story opportunity from the inbox to inspect its evidence and context.</p><Button onClick={onBack}>Back to Story Inbox</Button></div></div>;
  const interviewCount = interview?.answers.length ?? 0;
  return <div className="workspace-content">
    <div className="page-heading"><div><button className="text-button row" onClick={onBack}><ArrowLeft size={14}/> Back to Story Inbox</button><span className="eyebrow">RBF.02 / INTERPRET</span><h1>Story details</h1><p>Understand what happened, why it matters, and what still needs your perspective.</p></div><div className="heading-actions"><Button variant="outline" onClick={onDismiss}><X size={14}/> Dismiss idea</Button><Button variant="lime" onClick={onDraft}><FileText size={14}/> Create draft</Button></div></div>
    <div className="two-col"><div className="stack">
      <section className="panel"><div className="panel-body"><div className="row wrap"><Badge>{story.category}</Badge><StoryStatusBadge status={story.status}/><Badge>{story.confidence} evidence</Badge>{story.demo && <Badge>Sample</Badge>}</div><h2 style={{ fontSize: 27, lineHeight: 1.1, letterSpacing: "-.045em", color: "var(--forest)", margin: "16px 0 11px" }}>{story.title}</h2><p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--ink-muted)", margin: 0 }}>{story.summary}</p>{story.whyItMatters && <><hr className="separator"/><div className="context-heading">Why this story might matter</div><p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>{story.whyItMatters}</p></>}<hr className="separator"/><div className="context-heading">Suggested story angle</div><p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>{story.angle}</p></div></section>
      <section className="panel"><div className="panel-header"><div className="row"><FileCheck size={17}/><span className="panel-title">Source evidence</span></div><Badge>{story.evidence.length} source{story.evidence.length===1?"":"s"}</Badge></div><div className="panel-body stack">{story.evidence.length ? story.evidence.map(e => <div key={e.id} className="library-row"><span className="feature-icon" style={{ margin: 0 }}><FileCode2 size={17}/></span><div className="library-row-main"><a href={e.url.startsWith("http") ? e.url : undefined} onClick={e.url.startsWith("http") ? undefined : ev => ev.preventDefault()} target={e.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={{ fontWeight: 750, fontSize: 12, textDecoration: "none", color: "var(--forest)" }}>{e.label} {e.url.startsWith("http") && <ExternalLink size={11} style={{ display: "inline" }}/>}</a><div className="small muted" style={{ marginTop: 5 }}>{e.excerpt || (e.url.startsWith("http") ? "Source artifact linked for review." : "Builder-provided material stored in this browser.")}</div><div className="row wrap" style={{ marginTop: 6, gap: 6 }}>{e.sourceStatus && <Badge tone={e.sourceStatus === "source-supported" ? "success" : e.sourceStatus === "builder-provided" ? "neutral" : "warning"}>{e.sourceStatus === "source-supported" ? "Source-supported" : e.sourceStatus === "builder-provided" ? "Builder-provided" : e.sourceStatus === "hypothesis" ? "Hypothesis" : "Unknown"}</Badge>}{e.collectedAt && <span className="small muted">Collected {fmtDate(e.collectedAt)}</span>}</div></div></div>) : <div className="alert alert-warning"><CircleHelp size={16}/><span>No external source has been attached. Treat this as builder-provided context and avoid unsupported factual claims.</span></div>}{story.sourceFacts.length > 0 && <div><div className="context-heading">Facts extracted from sources</div><ul style={{ paddingLeft: 18, margin: 0, color: "var(--ink-muted)", fontSize: 12, lineHeight: 1.8 }}>{story.sourceFacts.map((fact, i) => <li key={i}>{fact}</li>)}</ul></div>}</div></section>
    </div><aside className="stack">
      <section className="panel"><div className="panel-header"><div className="row"><MessageCircleQuestion size={17}/><span className="panel-title">Interview the builder</span></div><Badge tone={interview?.complete ? "success" : interviewCount ? "warning" : "neutral"}>{interview?.complete ? "Complete" : interviewCount ? `${interviewCount} answered` : "Optional but useful"}</Badge></div><div className="panel-body stack">
        <p className="context-copy">Releasebuff should understand the story behind the change—not just the change itself. The interview asks follow-up questions until it has enough context, skipping what sources already tell us.</p>
        {!interview?.currentQuestion && !interview?.complete && <Button className="button-block" variant="lime" onClick={onStartInterview} disabled={interviewBusy}>{interviewBusy ? <LoaderCircle className="spinning" size={14}/> : <MessageSquareText size={14}/>} {interviewCount ? "Resume interview" : "Start story interview"}</Button>}
        {interviewBusy && <div className="alert alert-info"><LoaderCircle className="spinning" size={15}/><span>Finding the most useful next question…</span></div>}
        {interview?.currentQuestion && <><div className="question-box"><span className="eyebrow">QUESTION {interviewCount + 1} · ADAPTIVE INTERVIEW</span><p style={{ margin: "7px 0 0", lineHeight: 1.65 }}>{interview.currentQuestion}</p></div><textarea className="textarea" rows={4} value={interviewAnswerDraft} onChange={e => setInterviewAnswerDraft(e.target.value)} placeholder="Answer naturally, in your own words…" aria-label="Your interview answer"/><div className="row wrap"><Button variant="lime" onClick={onAnswerInterview} disabled={interviewBusy || !interviewAnswerDraft.trim()}>{interviewBusy ? <LoaderCircle className="spinning" size={14}/> : <ArrowRight size={14}/>} Answer & continue</Button><Button variant="outline" onClick={onSkipInterview} disabled={interviewBusy}>Skip question</Button></div><div className="form-help">One question at a time. You can skip questions and resume later. Answers are saved locally in this browser.</div></>}
        {interview?.complete && <><div className="alert alert-success"><CheckCircle2 size={16}/><span>The interview is complete. Review the captured context below before drafting.</span></div>{interview.summary && <div className="question-box"><div className="context-heading">Story context summary</div><p style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.65, margin: "7px 0 0" }}>{interview.summary}</p></div>}<div className="stack" style={{ gap: 8 }}>{interview.answers.filter(a => !a.skipped && a.answer.trim()).map((a,i) => <div key={`${i}-${a.question}`} className="library-row"><div className="library-row-main"><div className="small muted">{a.question}</div><div className="small" style={{ marginTop: 4 }}>{a.answer}</div></div></div>)}</div><Button variant="lime" className="button-block" onClick={onDraft}>Continue to Draft Studio <ArrowRight size={14}/></Button></>}
      </div></section>
      {story.requiresContext && <section className="panel"><div className="panel-header"><div className="row"><MessageCircleQuestion size={17}/><span className="panel-title">Additional context</span></div><Badge tone="warning">May be needed</Badge></div><div className="panel-body stack"><div className="question-box">{story.requiresContext}</div><textarea className="textarea" value={extraContext} onChange={e => setExtraContext(e.target.value)} placeholder="Add more context here, or use the structured interview above…" style={{ minHeight: 110 }}/><div className="form-help">This context is included in the Story Brief for drafting. Do not share confidential customer or secret data.</div></div></section>}
      <section className="panel"><div className="panel-header"><span className="panel-title">Before drafting</span></div><div className="panel-body stack" style={{ gap: 10 }}><StatusLine label="Source evidence" value={story.evidence.length ? "Linked" : "Builder input"} ok={story.evidence.length > 0}/><StatusLine label="Interview context" value={interview?.complete ? "Captured" : interviewCount ? "In progress" : "Not started"} ok={Boolean(interview?.complete)}/><StatusLine label="Claims verified" value="Review required" ok={false}/><Button variant="lime" className="button-block" onClick={onDraft}>Continue to Draft Studio <ArrowRight size={14}/></Button></div></section>
    </aside></div>
  </div>;
}
function FileSearchIcon() { return <Search size={22}/>; }

function StoryCategories({ stories, onChoose }: { stories: StoryOpportunity[]; onChoose: (category: StoryCategory) => void }) {
  return <div className="workspace-content"><div className="page-heading"><div><span className="eyebrow">RBF / TAXONOMY</span><h1>Story categories</h1><p>Sixteen ways to talk about building. These categories filter one Story Inbox; they do not create separate feeds.</p></div><Badge>{ALL_CATEGORIES.length} categories · 4 groups</Badge></div>
    {CATEGORY_GROUPS.map(group => { const Icon = groupIcon[group.name]; return <section className="category-group" key={group.name}><div className="category-group-header"><div><div className="row" style={{ gap: 7, marginBottom: 5 }}><Icon size={16} color="var(--forest)"/><span className="eyebrow">{group.name.toUpperCase()}</span></div><h2>{group.tagline}</h2></div><span className="small muted">{group.categories.length} categories</span></div><div className="category-grid">{group.categories.map(category => { const count = stories.filter(s => s.category === category.name).length; const ready = stories.some(s => s.category === category.name && s.status === "ready-to-draft"); const ContextIcon = categoryIcon[category.name] ?? Sparkles; return <button className="category-card" key={category.name} onClick={() => onChoose(category.name)}><div className="row-between"><span className="feature-icon" style={{ width: 31, height: 31, margin: 0 }}><ContextIcon size={15}/></span><Badge tone={ready ? "success" : count ? "warning" : "neutral"}>{ready ? "Evidence found" : count ? "Needs context" : category.sourceMode === "metrics" ? "Needs metrics" : category.sourceMode === "builder" ? "Builder input" : "Available"}</Badge></div><h3>{category.name}</h3><p>{category.description}</p><div className="category-card-bottom"><span className="small muted">{category.evidenceHint}</span><span className="mono small" style={{ color: "var(--forest)", whiteSpace: "nowrap" }}>{count} {count === 1 ? "story" : "stories"} <ChevronRight size={12} style={{ display: "inline" }}/></span></div></button>; })}</div></section>; })}
  </div>;
}

function DraftStudio({ story, drafts, currentDraftId, draftText, setDraftText, draftPlatform, setDraftPlatform, draftMode, draftBusy, extraContext, setExtraContext, onGenerate, onSaveLocal, onCopy, onBufferAction, onBack, bufferStatus, health, writingPreferences, setWritingPreferences, interviewSummary, reviewWarnings, brandKit, productName }: {
  story: StoryOpportunity | null; drafts: LocalDraft[]; currentDraftId: string | null; draftText: string; setDraftText: (v: string) => void; draftPlatform: "linkedin" | "x"; setDraftPlatform: (v: "linkedin" | "x") => void;
  draftMode: "ai" | "grounded-template" | "none"; draftBusy: boolean; extraContext: string; setExtraContext: (v: string) => void; onGenerate: () => void; onSaveLocal: () => void; onCopy: () => void; onBufferAction: (action: Exclude<BufferAction, null>) => void; onBack: () => void; bufferStatus: BufferStatus; health: { aiConfigured: boolean; bufferConfigured: boolean } | null; writingPreferences: StoryWritingPreferences; setWritingPreferences: React.Dispatch<React.SetStateAction<StoryWritingPreferences>>; interviewSummary: string; reviewWarnings: string[]; brandKit: BrandKit; productName: string;
}) {
  const existing = drafts.find(d => d.id === currentDraftId);
  return <div className="workspace-content"><div className="page-heading"><div><span className="eyebrow">RBF.03 / DRAFT</span><h1>Draft Studio</h1><p>Shape a source-backed story into a post. You review the wording and explicitly choose whether to save, schedule or publish through Buffer.</p></div><div className="heading-actions"><Button variant="outline" onClick={onBack}><ArrowLeft size={14}/> Back</Button><Button variant="lime" onClick={onSaveLocal}><Save size={14}/> Save locally</Button></div></div>
    <div className="two-col"><section className="panel"><div className="panel-body">
      <div className="draft-toolbar"><div className="row wrap"><Badge>{story?.category ?? existing?.category ?? "Unlinked draft"}</Badge>{draftMode === "ai" ? <Badge tone="success">AI-assisted</Badge> : draftMode === "grounded-template" ? <Badge>Grounded template</Badge> : <Badge>Not generated</Badge>}</div><div className="row"><label className="small muted" htmlFor="draftPlatform">Platform</label><select className="select" id="draftPlatform" value={draftPlatform} onChange={e => setDraftPlatform(e.target.value as "linkedin" | "x")} style={{ width: 150 }}><option value="linkedin">LinkedIn</option><option value="x">X</option></select></div></div>
      {story ? <div className="alert alert-info" style={{ marginBottom: 14 }}><FileCheck size={16}/><div><strong>{story.title}</strong><br/><span>{story.summary}</span></div></div> : <div className="alert alert-warning" style={{ marginBottom: 14 }}><CircleHelp size={16}/><span>This draft isn&apos;t linked to a discovered story. Check its claims before sending it to Buffer.</span></div>}
      {interviewSummary && <div className="question-box" style={{ marginBottom: 14 }}><div className="context-heading">Builder interview summary</div><p className="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, margin: "6px 0 0" }}>{interviewSummary}</p></div>}
      {story?.requiresContext && <div className="stack" style={{ marginBottom: 15 }}><label className="form-label" htmlFor="draftContext">Additional context (optional)</label><textarea id="draftContext" className="textarea" style={{ minHeight: 85 }} value={extraContext} onChange={e => setExtraContext(e.target.value)} placeholder={story.requiresContext}/></div>}
      <details className="panel" style={{ margin: "0 0 15px", boxShadow: "none", borderRadius: 12 }}><summary style={{ cursor: "pointer", padding: 14, fontWeight: 750, fontSize: 13 }}>Personalize the opening and ending <span className="small muted">· optional</span></summary><div className="panel-body form-stack" style={{ paddingTop: 0 }}>
        <div><label className="form-label" htmlFor="openingStyle">How should your post begin?</label><select id="openingStyle" className="select" value={writingPreferences.openingStyle} onChange={e => setWritingPreferences(prev => ({ ...prev, openingStyle: e.target.value as StoryWritingPreferences["openingStyle"] }))}><option value="ai">Choose the strongest opening for this story</option><option value="problem">Start with the problem</option><option value="personal">Start with a personal thought or experience</option><option value="specific-moment">Start with a specific moment or detail</option><option value="question">Start with an interesting question</option><option value="custom">Use my exact opening</option></select>{writingPreferences.openingStyle === "custom" && <textarea className="textarea" rows={2} value={writingPreferences.customOpening ?? ""} onChange={e => setWritingPreferences(prev => ({ ...prev, customOpening: e.target.value }))} placeholder="Write your opening in your own words…" style={{ marginTop: 7 }}/>}</div>
        <div><label className="form-label" htmlFor="closingStyle">How should your post end?</label><select id="closingStyle" className="select" value={writingPreferences.closingStyle} onChange={e => setWritingPreferences(prev => ({ ...prev, closingStyle: e.target.value as StoryWritingPreferences["closingStyle"] }))}><option value="ai">Choose a natural ending for this story</option><option value="reflection">End with a personal reflection</option><option value="question">End with a question for the audience</option><option value="product-cta">Invite people to explore the product</option><option value="next-step">End with what&apos;s next</option><option value="custom">Use my exact closing</option></select>{writingPreferences.closingStyle === "custom" && <textarea className="textarea" rows={2} value={writingPreferences.customClosing ?? ""} onChange={e => setWritingPreferences(prev => ({ ...prev, customClosing: e.target.value }))} placeholder="Write your closing in your own words…" style={{ marginTop: 7 }}/>}</div>
        <div className="form-help">Skip either preference by leaving it on the AI-selected option. Custom wording is preserved as closely as possible.</div>
      </div></details>
      {reviewWarnings.length > 0 && <div className="alert alert-warning" style={{ marginBottom: 13 }}><AlertCircle size={16}/><div><strong>Review these claims before publishing</strong><ul style={{ paddingLeft: 18, margin: "6px 0 0", lineHeight: 1.7 }}>{reviewWarnings.map((w,i) => <li key={i}>{w}</li>)}</ul></div></div>}
      <div className="row-between" style={{ marginBottom: 8 }}><label className="form-label" htmlFor="postText" style={{ marginBottom: 0 }}>Post content</label><span className="small muted">{draftText.length} characters</span></div><textarea id="postText" className="textarea" value={draftText} onChange={e => setDraftText(e.target.value)} rows={16} placeholder={story ? "Generate a grounded draft from this story…" : "Write or paste a post here…"} style={{ minHeight: 350, fontSize: 14, lineHeight: 1.75 }}/>
      <div className="draft-actions"><Button variant="lime" onClick={onGenerate} disabled={draftBusy || !story}>{draftBusy ? <LoaderCircle size={14} className="spinning"/> : <WandSparkles size={14}/>} {draftBusy ? "Generating…" : "Generate grounded draft"}</Button><Button variant="outline" onClick={onCopy} disabled={!draftText.trim()}><Copy size={14}/> Copy text</Button><Button variant="outline" onClick={onSaveLocal} disabled={!draftText.trim()}><Save size={14}/> Save locally</Button></div>
      {!health?.aiConfigured && <div className="form-help" style={{ marginTop: 12 }}>The AI provider isn&apos;t configured. The draft endpoint will use a grounded template fallback until you add an OpenAI API key to .env.local.</div>}
      {story?.evidence.length ? <div style={{ marginTop: 19 }}><div className="context-heading">Supporting evidence</div><EvidenceList story={story}/></div> : null}
    </div></section>
    <aside className="stack"><section className="panel"><div className="panel-header"><span className="panel-title">Publish through Buffer</span><Badge tone={bufferStatus.connected ? "success" : "neutral"}>{bufferStatus.connected ? "Connected" : "Not connected"}</Badge></div><div className="panel-body stack"><div className="context-copy">Review your post before choosing a destination. Releasebuff sends posts to Buffer only after you confirm the action.</div>{!bufferStatus.connected ? <><div className="alert alert-warning"><LockKeyhole size={16}/><span>Connect Buffer to load your real channels and enable publishing.</span></div><a className="button button-block" href="/api/buffer/connect"><LockKeyhole size={14}/> Connect Buffer</a></> : <><Button className="button-block" variant="lime" onClick={() => onBufferAction("publish")} disabled={!draftText.trim()}><Send size={14}/> Publish now</Button><Button className="button-block" variant="outline" onClick={() => onBufferAction("schedule")} disabled={!draftText.trim()}><CalendarClock size={14}/> Schedule post</Button><Button className="button-block" variant="outline" onClick={() => onBufferAction("draft")} disabled={!draftText.trim()}><FileText size={14}/> Save draft to Buffer</Button></>}<div className="form-help">No post is published by generating or saving this editor. Immediate publishing and scheduling require their own confirmation.</div></div></section>
      <StoryVisualStudio story={story} draftText={draftText} productName={productName} kit={brandKit} />
      <section className="panel"><div className="panel-header"><span className="panel-title">Draft checklist</span></div><div className="panel-body stack" style={{ gap: 10 }}><StatusLine label="Story selected" value={story ? "Linked" : "Optional"} ok={Boolean(story)}/><StatusLine label="Evidence available" value={story?.evidence.length ? `${story.evidence.length} source(s)` : "Check manually"} ok={Boolean(story?.evidence.length)}/><StatusLine label="Post text" value={draftText.trim() ? "Added" : "Empty"} ok={Boolean(draftText.trim())}/><StatusLine label="Publishing confirmation" value="Required" ok={false}/></div></section>
      {existing && <section className="panel"><div className="panel-header"><span className="panel-title">Saved draft info</span></div><div className="panel-body context-copy">Created {fmtDate(existing.createdAt)}<br/>Updated {fmtDate(existing.updatedAt)}<br/>Status: {existing.status}</div></section>}
    </aside></div>
  </div>;
}

function DraftLibrary({ drafts, search, setSearch, filter, setFilter, onOpen, onDelete }: { drafts: LocalDraft[]; search: string; setSearch: (v: string) => void; filter: string; setFilter: (v: string) => void; onOpen: (d: LocalDraft) => void; onDelete: (id: string) => void }) {
  const filtered = drafts.filter(d => (filter === "all" || d.status === filter) && `${d.title} ${d.text} ${d.category} ${d.channelName ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="workspace-content"><div className="page-heading"><div><span className="eyebrow">RBF / LIBRARY</span><h1>Draft library</h1><p>Find drafts saved in this browser or reopen a post to continue editing it. Buffer posts are marked with their returned status when available.</p></div><Badge>{drafts.length} saved</Badge></div>
    <div className="filter-row"><div className="search-wrap"><Search size={15}/><input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search drafts…" aria-label="Search drafts"/></div><select className="select filter-select" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option><option value="local-only">Local only</option><option value="draft">Buffer draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></div>
    {filtered.length ? <div className="library-list">{filtered.map(d => <div className="library-row" key={d.id}><span className="feature-icon" style={{ margin: 0 }}><FileText size={18}/></span><div className="library-row-main"><div className="row wrap"><Badge>{d.category}</Badge><Badge tone={d.status === "scheduled" || d.status === "published" ? "success" : "neutral"}>{d.status}</Badge><span className="small muted">{d.platform === "linkedin" ? "LinkedIn" : "X"}</span></div><h3>{d.title}</h3><p className="story-summary">{d.text.length > 230 ? `${d.text.slice(0, 230)}…` : d.text}</p><div className="row wrap small muted" style={{ marginTop: 8 }}><span>Updated {fmtDate(d.updatedAt)}</span>{d.channelName && <><span>·</span><span>{d.channelName}</span></>}{d.bufferPostId && <><span>·</span><span className="mono">Buffer ID {d.bufferPostId}</span></>}</div></div><div className="stack" style={{ gap: 5 }}><Button variant="outline" size="sm" onClick={() => onOpen(d)}>Edit <ArrowRight size={12}/></Button><Button variant="ghost" size="sm" onClick={() => onDelete(d.id)}><Trash2 size={13}/></Button></div></div>)}</div> : <div className="empty-state"><div className="empty-icon"><BookMarked size={22}/></div><h3>{drafts.length ? "No matching drafts" : "Your drafts will appear here"}</h3><p>{drafts.length ? "Try a different search term or status filter." : "Create a post from a story opportunity, save it locally, or send it to Buffer as a draft."}</p><span className="small muted">Browser-local drafts do not sync between devices or browsers.</span></div>}
  </div>;
}

function BufferActionModal({ action, onClose, onConfirm, busy, error, connected, configured, channels, channelsBusy, selectedChannelId, setSelectedChannelId, onConnect, onRefreshChannels, text, setText, scheduleDate, setScheduleDate, scheduleTime, setScheduleTime, timezone, setTimezone, scheduleType, setScheduleType }: {
  action: Exclude<BufferAction, null>; onClose: () => void; onConfirm: () => void; busy: boolean; error: string; connected: boolean; configured: boolean; channels: BufferChannel[]; channelsBusy: boolean; selectedChannelId: string; setSelectedChannelId: (v: string) => void; onConnect: () => void; onRefreshChannels: () => void; text: string; setText: (v: string) => void; scheduleDate: string; setScheduleDate: (v: string) => void; scheduleTime: string; setScheduleTime: (v: string) => void; timezone: string; setTimezone: (v: string) => void; scheduleType: "automatic" | "notification"; setScheduleType: (v: "automatic" | "notification") => void;
}) {
  const [confirmStep, setConfirmStep] = useState(false);
  const [scheduleValidationError, setScheduleValidationError] = useState("");
  const actionTitle = action === "publish" ? "Publish now" : action === "schedule" ? "Schedule post" : "Save draft to Buffer";
  let dueUtc = "";
  let conversionError = "";
  if (action === "schedule") {
    try { dueUtc = localDateTimeToUtc(scheduleDate, scheduleTime, timezone); }
    catch (e) { conversionError = e instanceof Error ? e.message : "Choose a valid date and time."; }
  }
  const timeError = conversionError || scheduleValidationError;
  const handleReview = () => {
    if (action === "schedule" && (conversionError || !dueUtc || Date.parse(dueUtc) <= Date.now())) {
      setScheduleValidationError(conversionError || "Choose a date and time in the future.");
      return;
    }
    setScheduleValidationError("");
    setConfirmStep(true);
  };
  const handleConfirm = () => {
    if (action === "schedule" && (!dueUtc || Date.parse(dueUtc) <= Date.now())) {
      setScheduleValidationError("The selected time is no longer in the future. Choose another time.");
      setConfirmStep(false);
      return;
    }
    onConfirm();
  };
  const activeChannel = channels.find(c => c.id === selectedChannelId);
  const publishDescription = action === "publish" ? "Buffer will receive a request to publish this post now. The social platform may still take time to deliver it." : action === "schedule" ? "Buffer will schedule this post for the selected date and time." : "Buffer will save this post as a draft. It will not be scheduled or published.";
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="bufferModalTitle"><div className="modal-header"><div><span className="eyebrow">BUFFER / DISTRIBUTION</span><h2 id="bufferModalTitle">{confirmStep ? `Confirm: ${actionTitle}` : actionTitle}</h2></div><button className="button button-ghost button-icon" onClick={onClose} disabled={busy} aria-label="Close"><X size={17}/></button></div><div className="modal-body stack">
    {!connected ? <><div className="alert alert-warning"><LockKeyhole size={17}/><span>{configured ? "Buffer is not connected. Connect and authorize your account before continuing." : "Buffer OAuth is not configured yet. Add the required variables to .env.local, then restart the dev server."}</span></div><Button className="button-block" onClick={onConnect} disabled={!configured}><LockKeyhole size={14}/> Connect Buffer</Button></> : channelsBusy ? <div className="alert alert-info"><LoaderCircle className="spinning" size={16}/><span>Loading channels from Buffer…</span></div> : channels.length === 0 ? <><div className="alert alert-warning"><AlertCircle size={16}/><span>No connected Buffer channels were returned. Refresh channels or connect a social channel in Buffer.</span></div><Button variant="outline" onClick={onRefreshChannels}><RefreshCw size={14}/> Refresh channels</Button></> : <>
      {!confirmStep ? <>
        <div><label className="form-label" htmlFor="bufferChannel">Destination channel</label><select id="bufferChannel" className="select" value={selectedChannelId} onChange={e => setSelectedChannelId(e.target.value)}>{channels.map(c => <option value={c.id} key={c.id}>{c.organizationName} · {c.displayName || c.name} ({c.service}){c.isQueuePaused ? " · queue paused" : ""}</option>)}</select><div className="form-help">Channel details are loaded from the connected Buffer account.</div></div>
        {action === "schedule" && <><div className="schedule-fields"><div><label className="form-label" htmlFor="dueDate">Date</label><input className="input" id="dueDate" type="date" value={scheduleDate} onChange={e => { setScheduleDate(e.target.value); setScheduleValidationError(""); }} min={new Date().toLocaleDateString("en-CA")}/></div><div><label className="form-label" htmlFor="dueTime">Time</label><input className="input" id="dueTime" type="time" value={scheduleTime} onChange={e => { setScheduleTime(e.target.value); setScheduleValidationError(""); }}/></div></div><div><label className="form-label" htmlFor="dueTimezone">Timezone</label><select className="select" id="dueTimezone" value={timezone} onChange={e => { setTimezone(e.target.value); setScheduleValidationError(""); }}><option value={timezone}>{timezone} (current)</option>{["Africa/Lagos","Europe/Paris","UTC","America/New_York","America/Los_Angeles","Europe/London"].filter(t => t !== timezone).map(t => <option value={t} key={t}>{t}</option>)}</select><div className="form-help">Local time is converted to the UTC timestamp Buffer requires.</div></div><div><label className="form-label">Delivery method</label><div className="row wrap"><label className="row small"><input type="radio" checked={scheduleType === "automatic"} onChange={() => setScheduleType("automatic")} style={{ accentColor: "var(--forest)" }}/> Automatic publishing</label><label className="row small"><input type="radio" checked={scheduleType === "notification"} onChange={() => setScheduleType("notification")} style={{ accentColor: "var(--forest)" }}/> Notification (if supported)</label></div></div>{timeError && <div className="alert alert-error"><AlertCircle size={15}/><span>{timeError}</span></div>}</>}
        <div><label className="form-label" htmlFor="bufferText">Post content</label><textarea className="textarea" id="bufferText" value={text} onChange={e => setText(e.target.value)} rows={8} style={{ minHeight: 170 }}/><div className="form-help">Final review happens before the request is sent to Buffer.</div></div>
      </> : <>
        <div className="alert alert-warning"><AlertCircle size={17}/><span>{publishDescription}</span></div>
        <div className="panel" style={{ boxShadow: "none" }}><div className="panel-body stack" style={{ gap: 10 }}><div><div className="eyebrow">DESTINATION</div><div style={{ fontSize: 13, fontWeight: 750, marginTop: 5 }}>{activeChannel?.displayName || activeChannel?.name} · {activeChannel?.service}</div><div className="small muted">{activeChannel?.organizationName}</div></div>{action === "schedule" && <div><div className="eyebrow">PUBLICATION TIME</div><div style={{ fontSize: 13, fontWeight: 750, marginTop: 5 }}>{scheduleDate} at {scheduleTime}</div><div className="small muted">{timezone} · UTC {dueUtc}</div></div>}<div><div className="eyebrow">POST CONTENT</div><p style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 220, overflow: "auto", margin: "7px 0 0" }}>{text}</p></div></div></div>
      </>}
      {error && <div className="alert alert-error"><AlertCircle size={16}/><span>{error}</span></div>}
    </>}
    </div><div className="modal-footer"><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>{connected && channels.length > 0 && <>{confirmStep ? <><Button variant="outline" onClick={() => setConfirmStep(false)} disabled={busy}>Edit details</Button><Button variant="lime" onClick={handleConfirm} disabled={busy || (action === "schedule" && Boolean(timeError)) || !text.trim()}>{busy ? <LoaderCircle size={14} className="spinning"/> : <CheckCheck size={14}/>} {busy ? "Sending…" : actionTitle}</Button></> : <Button variant="lime" onClick={handleReview} disabled={!text.trim() || (action === "schedule" && Boolean(conversionError))}>{action === "draft" ? "Review draft" : action === "publish" ? "Review before publishing" : "Review schedule"} <ArrowRight size={14}/></Button>}</>}</div></section></div>;
}
