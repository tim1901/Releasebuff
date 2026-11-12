"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import type { BrandKit, StoryOpportunity } from "@/lib/types";
import {
  buildStoryVisualSvg,
  createContextualVisualPlan,
  type StoryVisualPlan,
  type VisualLayout
} from "@/lib/visual-template";

const LINKEDIN_WIDTH = 1200;
const LINKEDIN_HEIGHT = 630;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "linkedin-graphic";
}

type StoryVisualStudioProps = { story: StoryOpportunity | null; draftText: string; productName: string; kit: BrandKit };
type VisualPlanResponse = { plan?: StoryVisualPlan; mode?: "ai" | "contextual-fallback"; error?: string };

async function fetchVisualPlan(
  story: StoryOpportunity,
  draftText: string,
  productName: string,
  brandKit: BrandKit
): Promise<{ plan: StoryVisualPlan; source: "ai" | "context" }> {
  const response = await fetch("/api/ai/visual-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ story, draftText, productName, brandKit: { ...brandKit, aspectRatio: "landscape" } }),
    cache: "no-store"
  });
  const data = await response.json() as VisualPlanResponse;
  if (!response.ok || !data.plan) throw new Error(data.error || "Could not refine the visual plan.");
  return { plan: data.plan, source: data.mode === "ai" ? "ai" : "context" };
}

async function svgToPng(svg: string): Promise<Blob> {
  // Data URLs work more reliably than SVG blob URLs in Safari when rasterising SVG to canvas.
  const imageSource = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The graphic preview loaded, but this browser could not convert it to PNG. Download the SVG instead."));
    image.src = imageSource;
  });
  const canvas = document.createElement("canvas");
  canvas.width = LINKEDIN_WIDTH;
  canvas.height = LINKEDIN_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG export is not available in this browser. Download the SVG instead.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, LINKEDIN_WIDTH, LINKEDIN_HEIGHT);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not encode the PNG file. Download the SVG instead.")), "image/png");
  });
}

export default function StoryVisualStudio(props: StoryVisualStudioProps) {
  return <StoryVisualStudioEditor key={props.story?.id ?? "no-story"} {...props} />;
}

function StoryVisualStudioEditor({ story, draftText, productName, kit }: StoryVisualStudioProps) {
  const linkedinKit = useMemo(() => ({ ...kit, aspectRatio: "landscape" as const }), [kit]);
  const [layout, setLayout] = useState<VisualLayout>("auto");
  const [headlineOverride, setHeadlineOverride] = useState("");
  const [supportingOverride, setSupportingOverride] = useState("");
  const [visualPlan, setVisualPlan] = useState<StoryVisualPlan | null>(null);
  const [planSource, setPlanSource] = useState<"context" | "ai">("context");
  const [planning, setPlanning] = useState(false);
  const [exportBusy, setExportBusy] = useState<"" | "png">("");
  const [exportError, setExportError] = useState("");
  const requestedSignature = useRef("");

  const fallbackPlan = useMemo(
    () => createContextualVisualPlan({ story, draftText, productName }),
    [story, draftText, productName]
  );
  const activePlan = visualPlan ?? fallbackPlan;
  const headline = headlineOverride.trim() || activePlan.headline;
  const svg = useMemo(() => buildStoryVisualSvg({
    kit: linkedinKit,
    story,
    draftText,
    productName,
    headlineOverride: headlineOverride.trim() || undefined,
    supportingLineOverride: supportingOverride.trim() || undefined,
    layout,
    visualPlan: activePlan,
    width: LINKEDIN_WIDTH,
    height: LINKEDIN_HEIGHT,
    motionProgress: 0.4
  }), [linkedinKit, story, draftText, productName, headlineOverride, supportingOverride, layout, activePlan]);
  const previewSrc = useMemo(() => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), [svg]);
  const canExport = Boolean(story || draftText.trim());

  useEffect(() => {
    let cancelled = false;
    const signature = JSON.stringify([story?.id, draftText, productName, linkedinKit]);
    if (!story || !draftText.trim() || requestedSignature.current === signature) return () => { cancelled = true; };
    const timer = window.setTimeout(() => {
      requestedSignature.current = signature;
      void fetchVisualPlan(story, draftText, productName, linkedinKit).then(result => {
        if (!cancelled) {
          setVisualPlan(result.plan);
          setPlanSource(result.source);
        }
      }).catch(() => {
        // Keep the immediate, context-aware graphic available when AI art direction is unavailable.
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [story, draftText, productName, linkedinKit]);

  async function requestArtDirection() {
    if (!story) return;
    setPlanning(true);
    setExportError("");
    try {
      const result = await fetchVisualPlan(story, draftText, productName, linkedinKit);
      setVisualPlan(result.plan);
      setPlanSource(result.source);
    } catch (error) {
      setVisualPlan(fallbackPlan);
      setPlanSource("context");
      setExportError(error instanceof Error ? error.message : "Using the context-based graphic.");
    } finally {
      setPlanning(false);
    }
  }

  function downloadSvg() {
    setExportError("");
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), slug(headline) + "-linkedin.svg");
  }

  async function downloadPng() {
    setExportBusy("png");
    setExportError("");
    try {
      const blob = await svgToPng(svg);
      downloadBlob(blob, slug(headline) + "-linkedin.png");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export PNG. Download the SVG instead.");
    } finally {
      setExportBusy("");
    }
  }

  const layoutLabel: Record<VisualLayout, string> = {
    auto: "Auto · decide from story context",
    spotlight: "Editorial spotlight",
    release: "Release recap",
    metric: "Verified metric",
    decision: "Decision / trade-off",
    lesson: "Lesson / takeaway",
    steps: "Build steps / roadmap"
  };

  return <section className="panel visual-studio-panel">
    <div className="panel-header">
      <div className="row"><ImageIcon size={16}/><span className="panel-title">LinkedIn graphic</span></div>
      <span className="badge badge-success"><Sparkles size={11}/> {planSource === "ai" ? "Claude art direction" : "Context-aware design"}</span>
    </div>
    <div className="panel-body stack">
      <div className="small muted">A static, editable graphic sized to 1200 × 630 px for a LinkedIn feed post. No GIF or animation required.</div>
      <div className="visual-preview-frame" style={{ background: linkedinKit.backgroundColor, aspectRatio: "1200 / 630" }}>
        <img className="visual-preview-image" src={previewSrc} alt={"Generated LinkedIn graphic: " + headline}/>
      </div>
      <div className="visual-edit-fields">
        <div><label className="form-label" htmlFor="visualHeadline">Graphic headline</label><input className="input" id="visualHeadline" value={headlineOverride} onChange={e => setHeadlineOverride(e.target.value)} placeholder={activePlan.headline}/></div>
        <div><label className="form-label" htmlFor="visualSupportingLine">Supporting line</label><textarea className="textarea" id="visualSupportingLine" rows={3} value={supportingOverride} onChange={e => setSupportingOverride(e.target.value)} placeholder={activePlan.supportingLine}/></div>
        <div><label className="form-label" htmlFor="visualLayout">Composition</label><select className="select" id="visualLayout" value={layout} onChange={e => setLayout(e.target.value as VisualLayout)}>{Object.entries(layoutLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><div className="form-help">The graphic is based on this post and its supported facts, using your current Brand Kit.</div></div>
      </div>
      <div className="visual-export-row">
        <button className="button button-lime button-sm" onClick={downloadPng} disabled={!canExport || Boolean(exportBusy)}>{exportBusy === "png" ? <LoaderCircle size={13} className="spinning"/> : <Download size={13}/>} {exportBusy === "png" ? "Preparing PNG…" : "Download PNG"}</button>
        <button className="button button-outline button-sm" onClick={downloadSvg} disabled={!canExport || Boolean(exportBusy)}><Download size={13}/> Download SVG</button>
        <button className="button button-outline button-sm" onClick={() => void requestArtDirection()} disabled={!story || planning || Boolean(exportBusy)}>{planning ? <LoaderCircle size={13} className="spinning"/> : <WandSparkles size={13}/>} {planning ? "Refining…" : "Refine with AI"}</button>
      </div>
      {exportError && <div className="alert alert-error">{exportError}</div>}
      <p className="form-help">Releasebuff creates the static graphic from the post, evidence and brand settings. PNG is ready to upload to LinkedIn; SVG is available as a crisp vector backup.</p>
    </div>
  </section>;
}
