"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, LoaderCircle, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import type { BrandKit, StoryOpportunity } from "@/lib/types";
import {
  buildStoryVisualSvg,
  createContextualVisualPlan,
  getVisualDimensions,
  type StoryVisualPlan,
  type VisualLayout
} from "@/lib/visual-template";
import { encodeAnimatedGif } from "@/lib/gif-encoder";
import { buildGifExplainerSvg, createFallbackGifExplainer, type GifExplainerPlan, type GifPlanMode } from "@/lib/gif-explainer";

async function renderSvgToRgba(svg: string, width: number, height: number): Promise<Uint8ClampedArray> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The graphic could not be rendered for export."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas export is not available in this browser.");
    context.drawImage(image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  } finally { URL.revokeObjectURL(url); }
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "story-visual"; }

type StoryVisualStudioProps = { story: StoryOpportunity | null; draftText: string; productName: string; kit: BrandKit };
type VisualPlanResponse = { plan?: StoryVisualPlan; mode?: "ai" | "contextual-fallback"; error?: string };

async function fetchVisualPlan(story: StoryOpportunity, draftText: string, productName: string, brandKit: BrandKit): Promise<{ plan: StoryVisualPlan; source: "ai" | "context" }> {
  const response = await fetch("/api/ai/visual-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ story, draftText, productName, brandKit })
  });
  const data = await response.json() as VisualPlanResponse;
  if (!response.ok || !data.plan) throw new Error(data.error || "Could not refine the visual plan.");
  return { plan: data.plan, source: data.mode === "ai" ? "ai" : "context" };
}

export default function StoryVisualStudio(props: StoryVisualStudioProps) {
  return <StoryVisualStudioEditor key={props.story?.id ?? "no-story"} {...props} />;
}

function StoryVisualStudioEditor({ story, draftText, productName, kit }: StoryVisualStudioProps) {
  const [layout, setLayout] = useState<VisualLayout>("auto");
  const [headlineOverride, setHeadlineOverride] = useState("");
  const [supportingOverride, setSupportingOverride] = useState("");
  const [visualPlan, setVisualPlan] = useState<StoryVisualPlan | null>(null);
  const [planSource, setPlanSource] = useState<"context" | "ai">("context");
  const [planning, setPlanning] = useState(false);
  const [exportBusy, setExportBusy] = useState<"" | "png" | "gif">("");
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null);
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifBlobSignature, setGifBlobSignature] = useState("");
  const [gifPlan, setGifPlan] = useState<GifExplainerPlan | null>(null);
  const [gifPlanMode, setGifPlanMode] = useState<GifPlanMode>("fallback");
  const [gifPlanBusy, setGifPlanBusy] = useState(false);
  const [gifPlanMessage, setGifPlanMessage] = useState("");
  const [gifPlanSignature, setGifPlanSignature] = useState("");
  const [exportError, setExportError] = useState("");
  const requestedStoryId = useRef<string | null>(null);
  const gifPreviewUrlRef = useRef<string | null>(null);
  const hasDraft = Boolean(draftText.trim());
  const fallbackPlan = useMemo(() => createContextualVisualPlan({ story, draftText, productName }), [story, draftText, productName]);
  const activePlan = visualPlan ?? fallbackPlan;
  const headline = headlineOverride.trim() || activePlan.headline;
  const svg = useMemo(() => buildStoryVisualSvg({
    kit, story, draftText, productName,
    headlineOverride: headlineOverride.trim() || undefined,
    supportingLineOverride: supportingOverride.trim() || undefined,
    layout, visualPlan: activePlan
  }), [kit, story, draftText, productName, headlineOverride, supportingOverride, layout, activePlan]);
  const previewSrc = useMemo(() => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), [svg]);
  const canExport = Boolean(story || draftText.trim());
  const gifSignature = JSON.stringify([story?.id, draftText, productName, kit.primaryColor, kit.accentColor, kit.backgroundColor, kit.textColor, kit.theme, kit.style, kit.fontFamily, kit.aspectRatio]);
  const activeGifPlan = gifPlanSignature === gifSignature ? gifPlan : null;
  const activeGifBlob = gifBlobSignature === gifSignature ? gifBlob : null;
  const activeGifPreviewUrl = gifBlobSignature === gifSignature ? gifPreviewUrl : null;

  useEffect(() => () => {
    if (gifPreviewUrlRef.current) URL.revokeObjectURL(gifPreviewUrlRef.current);
  }, []);

  function storeGifPreview(blob: Blob, signature: string) {
    const nextUrl = URL.createObjectURL(blob);
    if (gifPreviewUrlRef.current) URL.revokeObjectURL(gifPreviewUrlRef.current);
    gifPreviewUrlRef.current = nextUrl;
    setGifPreviewUrl(nextUrl);
    setGifBlob(blob);
    setGifBlobSignature(signature);
  }

  async function renderExplainerGifBlob(plan: GifExplainerPlan): Promise<Blob> {
    const width = 480;
    const height = kit.aspectRatio === "landscape" ? 252 : kit.aspectRatio === "portrait" ? 600 : 480;
    const frames: Uint8ClampedArray[] = [];
    for (let index = 0; index < plan.scenes.length; index++) {
      const frameSvg = buildGifExplainerSvg({
        kit, scene: plan.scenes[index], sceneIndex: index, sceneCount: plan.scenes.length,
        productName, width, height
      });
      frames.push(await renderSvgToRgba(frameSvg, width, height));
    }
    const bytes = encodeAnimatedGif(width, height, frames, 1350);
    return new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" });
  }

  async function requestArtDirection() {
    if (!story) return;
    setPlanning(true);
    setExportError("");
    try {
      const result = await fetchVisualPlan(story, draftText, productName, kit);
      setVisualPlan(result.plan);
      setPlanSource(result.source);
    } catch {
      setVisualPlan(fallbackPlan);
      setPlanSource("context");
      setExportError("Using the context-based fallback. The visual remains grounded in the selected story.");
    } finally {
      setPlanning(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!story || !hasDraft || requestedStoryId.current === story.id) return () => { cancelled = true; };
    const timer = window.setTimeout(() => {
      requestedStoryId.current = story.id;
      void fetchVisualPlan(story, draftText, productName, kit).then(result => {
        if (!cancelled) {
          setVisualPlan(result.plan);
          setPlanSource(result.source);
        }
      }).catch(() => {
        /* The context-based plan stays visible if AI art direction is unavailable. */
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [story, draftText, productName, kit, hasDraft]);

  const downloadSvg = () => {
    setExportError("");
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), slug(headline) + ".svg");
  };
  const downloadPng = async () => {
    setExportBusy("png"); setExportError("");
    try {
      const dimensions = getVisualDimensions(kit.aspectRatio);
      const rgba = await renderSvgToRgba(buildStoryVisualSvg({
        kit, story, draftText, productName,
        headlineOverride: headlineOverride.trim() || undefined,
        supportingLineOverride: supportingOverride.trim() || undefined,
        layout, visualPlan: activePlan,
        width: dimensions.width, height: dimensions.height, motionProgress: 0.4
      }), dimensions.width, dimensions.height);
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width; canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG export is not available in this browser.");
      const imageData = context.createImageData(dimensions.width, dimensions.height);
      imageData.data.set(rgba);
      context.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Could not encode the PNG file.")), "image/png"));
      downloadBlob(blob, slug(headline) + ".png");
    } catch (error) { setExportError(error instanceof Error ? error.message : "Could not export PNG."); }
    finally { setExportBusy(""); }
  };
  const downloadGif = async () => {
    setExportBusy("gif"); setExportError("");
    try {
      const width = 480;
      const height = kit.aspectRatio === "landscape" ? 252 : kit.aspectRatio === "portrait" ? 600 : 480;
      const frames: Uint8ClampedArray[] = [];
      for (let frame = 0; frame < 8; frame++) {
        const progress = frame / 7;
        const frameSvg = buildStoryVisualSvg({
          kit, story, draftText, productName,
          headlineOverride: headlineOverride.trim() || undefined,
          supportingLineOverride: supportingOverride.trim() || undefined,
          layout, visualPlan: activePlan, width, height, motionProgress: progress
        });
        frames.push(await renderSvgToRgba(frameSvg, width, height));
      }
      const bytes = encodeAnimatedGif(width, height, frames, 180);
      downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" }), slug(headline) + ".gif");
    } catch (error) { setExportError(error instanceof Error ? error.message : "Could not export GIF."); }
    finally { setExportBusy(""); }
  };

  async function createGifExplainerPlan() {
    if (!story) return;
    setGifPlanBusy(true);
    setGifPlanMessage("");
    setExportError("");
    try {
      const response = await fetch("/api/ai/gif-explainer-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, draftText, productName, brandKit: kit }),
        cache: "no-store"
      });
      const data = await response.json() as { plan?: GifExplainerPlan; mode?: "claude" | "fallback"; message?: string; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error || "Could not create the explainer storyboard.");
      setGifPlan(data.plan);
      setGifPlanMode(data.mode === "claude" ? "claude" : "fallback");
      setGifPlanSignature(gifSignature);
      setGifPlanMessage(data.message || (data.mode === "claude"
        ? "Claude tailored this storyboard to the current post. Review the animation below before downloading."
        : "Using a context-based storyboard. Add ANTHROPIC_API_KEY to enable Claude's post-specific art direction."));
      const blob = await renderExplainerGifBlob(data.plan);
      storeGifPreview(blob, gifSignature);
    } catch (error) {
      const fallback = createFallbackGifExplainer(story, draftText, productName);
      setGifPlan(fallback);
      setGifPlanMode("fallback");
      setGifPlanSignature(gifSignature);
      setGifPlanMessage(error instanceof Error ? error.message : "Claude was unavailable; a context-based storyboard is ready.");
      try {
        const blob = await renderExplainerGifBlob(fallback);
        storeGifPreview(blob, gifSignature);
      } catch (renderError) {
        setExportError(renderError instanceof Error ? renderError.message : "Could not render the fallback explainer GIF.");
      }
    } finally {
      setGifPlanBusy(false);
    }
  }

  const downloadExplainerGif = () => {
    if (!activeGifPlan || !activeGifBlob) return;
    downloadBlob(activeGifBlob, slug(activeGifPlan.headline) + "-explainer.gif");
  };

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
    <div className="panel-header"><div className="row"><ImageIcon size={16}/><span className="panel-title">Visual created alongside this draft</span></div><span className="badge badge-success"><Sparkles size={11}/> {planSource === "ai" ? "Claude art direction" : "Context-aware preview"}</span></div>
    <div className="panel-body stack">
      <div className="visual-preview-frame" style={{ background: kit.backgroundColor }}><img className="visual-preview-image" src={previewSrc} alt={"Generated graphic: " + headline}/></div>
      <div className="visual-edit-fields">
        <div><label className="form-label" htmlFor="visualHeadline">Graphic headline</label><input className="input" id="visualHeadline" value={headlineOverride} onChange={e => setHeadlineOverride(e.target.value)} placeholder={activePlan.headline}/></div>
        <div><label className="form-label" htmlFor="visualSupportingLine">Supporting line</label><textarea className="textarea" id="visualSupportingLine" rows={3} value={supportingOverride} onChange={e => setSupportingOverride(e.target.value)} placeholder={activePlan.supportingLine}/></div>
        <div><label className="form-label" htmlFor="visualLayout">Composition</label><select className="select" id="visualLayout" value={layout} onChange={e => setLayout(e.target.value as VisualLayout)}>{Object.entries(layoutLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><div className="form-help">Auto selects a composition from the story category and supported facts. AI art direction refines the headline, supporting line and evidence selection when available.</div></div>
      </div>
      <div className="visual-export-row">
        <button className="button button-lime button-sm" onClick={downloadPng} disabled={!canExport || Boolean(exportBusy)}>{exportBusy === "png" ? <LoaderCircle size={13} className="spinning"/> : <Download size={13}/>} PNG</button>
        <button className="button button-outline button-sm" onClick={downloadSvg} disabled={!canExport || Boolean(exportBusy)}><Download size={13}/> SVG</button>
        <button className="button button-outline button-sm" onClick={downloadGif} disabled={!canExport || Boolean(exportBusy)}>{exportBusy === "gif" ? <LoaderCircle size={13} className="spinning"/> : <RefreshCw size={13}/>} Quick GIF</button>
        <button className="button button-lime button-sm" onClick={() => void createGifExplainerPlan()} disabled={!story || gifPlanBusy || Boolean(exportBusy)}>{gifPlanBusy ? <LoaderCircle size={13} className="spinning"/> : <WandSparkles size={13}/>} {gifPlanBusy ? "Creating explainer…" : activeGifPlan ? "Rebuild explainer" : "Create explainer GIF"}</button>
        <button className="button button-outline button-sm" onClick={() => void requestArtDirection()} disabled={!story || planning || Boolean(exportBusy)}>{planning ? <LoaderCircle size={13} className="spinning"/> : <WandSparkles size={13}/>} {planning ? "Thinking…" : "Rethink visual"}</button>
      </div>
      {activeGifPlan && <div className="gif-storyboard stack">
        <div className="row-between wrap" style={{ gap: 8 }}><strong style={{ fontSize: 13, color: "var(--forest)" }}>Explainer storyboard</strong><span className="badge badge-success"><Sparkles size={10}/> {gifPlanMode === "claude" ? "Claude-directed" : "Context fallback"}</span></div>
        <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest)" }}>{activeGifPlan.headline}</h3>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>{activeGifPlan.subhead}</p>
        {activeGifPreviewUrl && <div className="gif-output-preview"><img src={activeGifPreviewUrl} alt="Animated explainer GIF preview" /><span className="small muted">Four-scene animated explainer · loops automatically</span></div>}
        <div className="gif-scene-list">{activeGifPlan.scenes.map((scene, index) => <div className="gif-scene-card" key={index}><div className="row-between" style={{ gap: 8 }}><span className="eyebrow">{String(index + 1).padStart(2, "0")} / {scene.kicker}</span><span className="badge">{scene.visual}</span></div><strong>{scene.title}</strong><p className="small muted">{scene.caption}</p>{scene.labels.length > 0 && <div className="row wrap">{scene.labels.map((label, i) => <span key={i} className="gif-scene-label">{label}</span>)}</div>}</div>)}</div>
        <button className="button button-lime button-sm" onClick={downloadExplainerGif} disabled={!activeGifBlob || Boolean(exportBusy)}><Download size={13}/> Download explainer GIF</button>
      </div>}
      {(activeGifPlan || gifPlanBusy) && gifPlanMessage && <div className="alert alert-info">{gifPlanMessage}</div>}
      {exportError && <div className="alert alert-error">{exportError}</div>}
      <p className="form-help">The graphic preview is editable. Create explainer GIF asks Claude to storyboard this specific post, then Releasebuff renders the scenes locally as a branded vector animation. Claude directs the visual plan; it does not return a finished image file.</p>
    </div>
  </section>;
}
