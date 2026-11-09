"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Image as ImageIcon, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import type { BrandKit, StoryOpportunity } from "@/lib/types";
import { buildStoryVisualSvg, getVisualDimensions, type VisualLayout } from "@/lib/visual-template";
import { encodeAnimatedGif } from "@/lib/gif-encoder";

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

export default function StoryVisualStudio({ story, draftText, productName, kit }: { story: StoryOpportunity | null; draftText: string; productName: string; kit: BrandKit }) {
  const [layout, setLayout] = useState<VisualLayout>("spotlight");
  const [headlineOverride, setHeadlineOverride] = useState("");
  const [supportingOverride, setSupportingOverride] = useState("");
  const [exportBusy, setExportBusy] = useState<"" | "png" | "gif">("");
  const [exportError, setExportError] = useState("");
  useEffect(() => { setHeadlineOverride(""); setSupportingOverride(""); setLayout("spotlight"); }, [story?.id]);
  const headline = headlineOverride.trim() || story?.title || draftText.split(/\n|[.!?]/).map(part => part.trim()).find(Boolean) || "A story from this build";
  const supporting = supportingOverride.trim() || story?.summary || draftText.replace(/\s+/g, " ").slice(0, 220) || "A small, specific look at the work behind the product.";
  const svg = useMemo(() => buildStoryVisualSvg({ kit, story, draftText, productName, headlineOverride: headline, supportingLineOverride: supporting, layout }), [kit, story, draftText, productName, headline, supporting, layout]);
  const previewSrc = useMemo(() => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), [svg]);
  const canExport = Boolean(story || draftText.trim());

  const downloadSvg = () => {
    setExportError("");
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), slug(headline) + ".svg");
  };
  const downloadPng = async () => {
    setExportBusy("png"); setExportError("");
    try {
      const dimensions = getVisualDimensions(kit.aspectRatio);
      const rgba = await renderSvgToRgba(buildStoryVisualSvg({ kit, story, draftText, productName, headlineOverride: headline, supportingLineOverride: supporting, layout, width: dimensions.width, height: dimensions.height, motionProgress: 0.4 }), dimensions.width, dimensions.height);
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width; canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG export is not available in this browser.");
      context.putImageData(new ImageData(rgba, dimensions.width, dimensions.height), 0, 0);
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
        const frameSvg = buildStoryVisualSvg({ kit, story, draftText, productName, headlineOverride: headline, supportingLineOverride: supporting, layout, width, height, motionProgress: progress });
        frames.push(await renderSvgToRgba(frameSvg, width, height));
      }
      const bytes = encodeAnimatedGif(width, height, frames, 180);
      downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" }), slug(headline) + ".gif");
    } catch (error) { setExportError(error instanceof Error ? error.message : "Could not export GIF."); }
    finally { setExportBusy(""); }
  };

  return <section className="panel visual-studio-panel">
    <div className="panel-header"><div className="row"><ImageIcon size={16}/><span className="panel-title">Visual created alongside this draft</span></div><span className="badge badge-success"><Sparkles size={11}/> Live preview</span></div>
    <div className="panel-body stack">
      <div className="visual-preview-frame" style={{ background: kit.backgroundColor }}><img className="visual-preview-image" src={previewSrc} alt={"Generated graphic: " + headline}/></div>
      <div className="visual-edit-fields">
        <div><label className="form-label" htmlFor="visualHeadline">Graphic headline</label><input className="input" id="visualHeadline" value={headlineOverride} onChange={e => setHeadlineOverride(e.target.value)} placeholder={story?.title || "Add a headline"}/></div>
        <div><label className="form-label" htmlFor="visualSupportingLine">Supporting line</label><textarea className="textarea" id="visualSupportingLine" rows={3} value={supportingOverride} onChange={e => setSupportingOverride(e.target.value)} placeholder={story?.summary || "Add one supporting detail"}/></div>
        <div><label className="form-label" htmlFor="visualLayout">Graphic format</label><select className="select" id="visualLayout" value={layout} onChange={e => setLayout(e.target.value as VisualLayout)}><option value="spotlight">Story spotlight</option><option value="lesson">Decision or lesson</option><option value="weekly">Weekly build recap</option></select></div>
      </div>
      <div className="visual-export-row">
        <button className="button button-lime button-sm" onClick={downloadPng} disabled={!canExport || Boolean(exportBusy)}>{exportBusy === "png" ? <LoaderCircle size={13} className="spinning"/> : <Download size={13}/>} PNG</button>
        <button className="button button-outline button-sm" onClick={downloadSvg} disabled={!canExport || Boolean(exportBusy)}><Download size={13}/> SVG</button>
        <button className="button button-outline button-sm" onClick={downloadGif} disabled={!canExport || Boolean(exportBusy)}>{exportBusy === "gif" ? <LoaderCircle size={13} className="spinning"/> : <RefreshCw size={13}/>} GIF</button>
      </div>
      {exportError && <div className="alert alert-error">{exportError}</div>}
      <p className="form-help">The graphic updates as the story or post changes. Exports use the saved Brand Kit and a small animation loop for GIF; no external image-generation API is required for this template-based version.</p>
    </div>
  </section>;
}
