"use client";

import { useMemo, useState } from "react";
import { Download, LoaderCircle, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import type { BrandKit, ProductProfile, StoryOpportunity } from "@/lib/types";
import { buildEditorialSvg, type EditorialPlan } from "@/lib/editorial-graphic";

const SIZE = 1080;
type Props = { story: StoryOpportunity | null; draftText: string; productName: string; kit: BrandKit; interviewSummary?: string; productProfile?: ProductProfile | null };
type PlanResponse = { plan?: EditorialPlan; error?: string };
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "releasebuff-editorial-graphic"; }
export default function StoryVisualStudio(props: Props) {
  return <Studio key={props.story?.id ?? "no-story"} {...props}/>;
}
function Studio({ story, draftText, productName, kit, interviewSummary = "", productProfile = null }: Props) {
  const [plan, setPlan] = useState<EditorialPlan | null>(null);
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [centralInsight, setCentralInsight] = useState("");
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [approved, setApproved] = useState(false);
  const ready = Boolean(story && (draftText.trim() || interviewSummary.trim() || story.summary.trim()));
  const currentPlan = useMemo(() => plan ? { ...plan, headline, subheadline, centralInsight } : null, [plan, headline, subheadline, centralInsight]);
  const svg = useMemo(() => currentPlan ? buildEditorialSvg(currentPlan, kit, productName) : "", [currentPlan, kit, productName]);

  async function createPlan(refine = false) {
    if (!story) return;
    setBusy(true); setError(""); setStatus(refine ? "Refining the editorial direction…" : "Analyzing the story and choosing a visual format…"); setApproved(false);
    try {
      const response = await fetch("/api/ai/editorial-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, draftText, productName, interviewSummary, productProfile, brandKit: kit, revisionNote: refine ? revision : "" }),
        cache: "no-store"
      });
      const data = await response.json() as PlanResponse;
      if (!response.ok || !data.plan) throw new Error(data.error || "The editorial creative director could not create a plan.");
      setPlan(data.plan); setHeadline(data.plan.headline); setSubheadline(data.plan.subheadline); setCentralInsight(data.plan.centralInsight);
      setRevision(""); setStatus("Editorial plan ready. Edit the copy below, inspect the composition, then approve or refine it.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the editorial plan."); setStatus(""); }
    finally { setBusy(false); }
  }
  async function downloadPng() {
    if (!svg) return;
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob); const image = new Image(); image.src = url;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not prepare the graphic for export.")); });
      const canvas = document.createElement("canvas"); canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Your browser cannot export this graphic.");
      ctx.drawImage(image, 0, 0, SIZE, SIZE); URL.revokeObjectURL(url);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG export failed.")), "image/png"));
      download(png, slug(headline || story?.title || productName) + "-1080x1080.png");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PNG export failed."); }
  }

  const format = plan?.archetype ? plan.archetype.replace("-", " ") : "not selected";
  return <section className="panel visual-studio-panel">
    <div className="panel-header">
      <div className="row"><Sparkles size={16}/><span className="panel-title">Editorial graphic studio</span></div>
      <span className="badge badge-success">Story-first design</span>
    </div>
    <div className="panel-body stack">
      <p className="small muted">Turns the builder interview, product intelligence profile and draft into an editorial explainer. Claude chooses the visual format; a precise renderer creates the headline, diagram, labels and layout. No generic image is substituted.</p>
      {!story && <div className="alert alert-warning">Select a story first so the creative director has the right context.</div>}
      {!plan ? <div className="visual-preview-frame" style={{ aspectRatio: "1 / 1", display: "grid", placeItems: "center", textAlign: "center", padding: 28 }}>
        <div className="stack" style={{ alignItems: "center" }}>
          {busy ? <LoaderCircle size={30} className="spinning"/> : <WandSparkles size={32}/>}
          <strong>{busy ? "Finding the clearest way to explain this story…" : "Create an editorial explainer"}</strong>
          <span className="small muted">System maps · process diagrams · evidence · comparisons · frameworks</span>
        </div>
      </div> : <>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <span className="badge">{format}</span><span className="small muted">1080 × 1080 px</span>
        </div>
        <div className="visual-preview-frame" style={{ background: kit.backgroundColor, aspectRatio: "1 / 1", overflow: "hidden" }}>
          <div role="img" aria-label={"Editorial graphic preview: " + headline} style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: svg }}/>
        </div>
        <div className="stack">
          <label className="form-label" htmlFor="editorialHeadline">Headline</label>
          <input id="editorialHeadline" className="input" value={headline} maxLength={90} onChange={e => { setHeadline(e.target.value); setApproved(false); }}/>
          <label className="form-label" htmlFor="editorialSubheadline">Supporting line</label>
          <textarea id="editorialSubheadline" className="textarea" rows={2} value={subheadline} maxLength={180} onChange={e => { setSubheadline(e.target.value); setApproved(false); }}/>
          <label className="form-label" htmlFor="editorialInsight">Main takeaway</label>
          <textarea id="editorialInsight" className="textarea" rows={2} value={centralInsight} maxLength={240} onChange={e => { setCentralInsight(e.target.value); setApproved(false); }}/>
          <div className="question-box stack">
            <div><div className="context-heading">Why this format?</div><p className="small" style={{ margin: "5px 0 0", lineHeight: 1.6 }}>{plan.rationale}</p></div>
            <div><div className="context-heading">Visual concept</div><p className="small" style={{ margin: "5px 0 0", lineHeight: 1.6 }}>{plan.illustrationBrief || plan.centralInsight}</p></div>
            {plan.evidenceNote && <div><div className="context-heading">Evidence note</div><p className="small" style={{ margin: "5px 0 0", lineHeight: 1.6 }}>{plan.evidenceNote}</p></div>}
          </div>
          <label className="form-label" htmlFor="editorialRevision">How should the next version change?</label>
          <textarea id="editorialRevision" className="textarea" rows={2} value={revision} onChange={e => setRevision(e.target.value)} placeholder="e.g. Make the system connections clearer; simplify the headline; emphasize the decision…"/>
        </div>
      </>}
      <div className="visual-export-row">
        <button className="button button-lime button-sm" onClick={() => void createPlan(false)} disabled={!ready || busy}>
          {busy && !revision ? <LoaderCircle size={13} className="spinning"/> : <WandSparkles size={13}/>} {plan ? "Create new direction" : "1. Create editorial plan"}
        </button>
        <button className="button button-outline button-sm" onClick={() => void createPlan(true)} disabled={!plan || !revision.trim() || busy}>
          {busy && Boolean(revision) ? <LoaderCircle size={13} className="spinning"/> : <RefreshCw size={13}/>} Refine design
        </button>
        <button className="button button-lime button-sm" onClick={() => { setApproved(true); setStatus("Graphic approved for use. Publishing remains a separate action."); }} disabled={!plan || approved}>Approve graphic</button>
        <button className="button button-outline button-sm" onClick={() => void downloadPng()} disabled={!plan}><Download size={13}/> Download 1080 PNG</button>
      </div>
      {approved && <div className="alert alert-info">Graphic approved. You can download it now; publishing the post is still a separate step.</div>}
      {status && <div className="alert alert-info">{status}</div>}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  </section>;
}
