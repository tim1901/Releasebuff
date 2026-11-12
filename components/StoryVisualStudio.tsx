"use client";

import { useState } from "react";
import { Download, Image as ImageIcon, LoaderCircle, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import type { BrandKit, StoryOpportunity } from "@/lib/types";

const OUTPUT_SIZE = 1080;

type StoryVisualStudioProps = {
  story: StoryOpportunity | null;
  draftText: string;
  productName: string;
  kit: BrandKit;
  interviewSummary?: string;
};
type PromptResponse = { concept?: string; emotionalAngle?: string; strongestMessage?: string; prompt?: string; error?: string };
type ImageResponse = { imageDataUrl?: string; imageUrl?: string; error?: string };

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "releasebuff-graphic";
}
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
async function normalizeToSquare1080(source: string): Promise<string> {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The generated image could not be loaded. Your prompt is preserved; please retry."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the 1080 × 1080 PNG. Please try another browser.");
  context.drawImage(image, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return canvas.toDataURL("image/png");
}

export default function StoryVisualStudio(props: StoryVisualStudioProps) {
  return <StoryVisualStudioEditor key={props.story?.id ?? "no-story"} {...props} />;
}

function StoryVisualStudioEditor({ story, draftText, productName, kit, interviewSummary = "" }: StoryVisualStudioProps) {
  const [concept, setConcept] = useState("");
  const [emotionalAngle, setEmotionalAngle] = useState("");
  const [strongestMessage, setStrongestMessage] = useState("");
  const [prompt, setPrompt] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [image, setImage] = useState("");
  const [promptBusy, setPromptBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const readyForPrompt = Boolean(story && (draftText.trim() || interviewSummary.trim() || story.summary.trim()));
  async function createPrompt(revise: boolean) {
    if (!story) return;
    setPromptBusy(true);
    setError("");
    setStatus(revise ? "Revising the creative direction…" : "Analyzing the interview and story…");
    try {
      const response = await fetch("/api/ai/graphic-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story,
          draftText,
          productName,
          interviewSummary,
          brandKit: { ...kit, aspectRatio: "square" },
          revisionNote: revise ? revisionNote : "",
          previousPrompt: revise ? prompt : ""
        }),
        cache: "no-store"
      });
      const data = await response.json() as PromptResponse;
      if (!response.ok || !data.prompt) throw new Error(data.error || "Claude could not create the image prompt.");
      setConcept(data.concept || "");
      setEmotionalAngle(data.emotionalAngle || "");
      setStrongestMessage(data.strongestMessage || "");
      setPrompt(data.prompt);
      setImage("");
      setStatus("Prompt ready. Review or edit it, then generate the image.");
      setRevisionNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the prompt. Please retry.");
      setStatus("");
    } finally { setPromptBusy(false); }
  }

  async function generateImage() {
    if (prompt.trim().length < 80) {
      setError("The prompt needs more detail. Generate a prompt with Claude or write a complete prompt before rendering.");
      return;
    }
    setImageBusy(true);
    setError("");
    setStatus("Rendering the actual graphic…");
    try {
      const response = await fetch("/api/ai/generate-graphic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        cache: "no-store"
      });
      const data = await response.json() as ImageResponse;
      if (!response.ok) throw new Error(data.error || "The image model could not render this graphic.");
      const source = data.imageDataUrl || data.imageUrl;
      if (!source) throw new Error("The image provider returned no image. Nothing was substituted; please retry.");
      const square = await normalizeToSquare1080(source);
      setImage(square);
      setStatus("Image generated at 1080 × 1080 px. Review it, refine the prompt, or regenerate before publishing.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image generation failed. Your prompt is preserved so you can retry.");
      setStatus("");
    } finally { setImageBusy(false); }
  }

  function downloadPng() {
    if (!image) return;
    const binary = atob(image.split(",")[1] || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    downloadBlob(new Blob([bytes], { type: "image/png" }), slug(concept || story?.title || productName) + "-1080x1080.png");
  }

  return <section className="panel visual-studio-panel">
    <div className="panel-header">
      <div className="row"><ImageIcon size={16}/><span className="panel-title">AI graphic studio</span></div>
      <span className="badge badge-success"><Sparkles size={11}/> Claude + image generation</span>
    </div>
    <div className="panel-body stack">
      <div className="small muted">Turn the builder interview and this post into a story-specific square graphic. Claude directs the creative and writes an editable prompt; the image model renders the actual artwork. No generic fallback image is used.</div>
      {!story && <div className="alert alert-warning">Select a story first so the creative director has the interview and product context.</div>}
      <div className="visual-preview-frame" style={{ background: kit.backgroundColor, aspectRatio: "1 / 1", overflow: "hidden", display: "grid", placeItems: "center" }}>
        {image ? <img className="visual-preview-image" src={image} alt={"Generated square graphic: " + (concept || story?.title || productName)} style={{ width: "100%", height: "100%", objectFit: "contain" }}/> :
          <div className="stack" style={{ alignItems: "center", textAlign: "center", padding: 28 }}>
            {imageBusy ? <LoaderCircle size={28} className="spinning"/> : <ImageIcon size={30}/>}
            <strong>{imageBusy ? "Creating your graphic…" : "Your generated artwork appears here"}</strong>
            <span className="small muted">1080 × 1080 px · square · real image generation</span>
          </div>}
      </div>

      {(concept || strongestMessage || emotionalAngle) && <div className="question-box stack">
        {concept && <div><div className="context-heading">Visual concept</div><p className="small" style={{ margin: "5px 0 0", lineHeight: 1.6 }}>{concept}</p></div>}
        {strongestMessage && <div><div className="context-heading">Single strongest message</div><p className="small" style={{ margin: "5px 0 0", lineHeight: 1.6 }}>{strongestMessage}</p></div>}
        {emotionalAngle && <div><div className="context-heading">Emotional angle</div><p className="small" style={{ margin: "5px 0 0", lineHeight: 1.6 }}>{emotionalAngle}</p></div>}
      </div>}

      <div className="stack">
        <label className="form-label" htmlFor="graphicPrompt">Editable image-generation prompt</label>
        <textarea id="graphicPrompt" className="textarea" rows={10} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Generate a creative prompt from the builder interview, story, post and Brand Kit. You can edit every part before rendering." style={{ minHeight: 220, lineHeight: 1.65 }} />
        <div className="form-help">The prompt describes composition, visual metaphor, typography, color roles, focal point, safe margins and restrictions. Edit it freely before rendering or regenerating.</div>
      </div>

      <div className="stack">
        <label className="form-label" htmlFor="graphicRevision">How should the next version change? <span className="small muted">· optional</span></label>
        <textarea id="graphicRevision" className="textarea" rows={2} value={revisionNote} onChange={e => setRevisionNote(e.target.value)} placeholder="e.g. Make the visual metaphor more distinctive, reduce text, use a warmer emotional tone…" />
      </div>

      <div className="visual-export-row">
        <button className="button button-lime button-sm" onClick={() => void createPrompt(false)} disabled={!readyForPrompt || promptBusy || imageBusy}>
          {promptBusy && !revisionNote ? <LoaderCircle size={13} className="spinning"/> : <WandSparkles size={13}/>} {promptBusy ? "Creative director working…" : prompt ? "Create new prompt" : "1. Create image prompt"}
        </button>
        <button className="button button-outline button-sm" onClick={() => void createPrompt(true)} disabled={!story || !prompt.trim() || !revisionNote.trim() || promptBusy || imageBusy}>
          {promptBusy && Boolean(revisionNote) ? <LoaderCircle size={13} className="spinning"/> : <RefreshCw size={13}/>} Revise prompt
        </button>
        <button className="button button-lime button-sm" onClick={() => void generateImage()} disabled={prompt.trim().length < 80 || imageBusy || promptBusy}>
          {imageBusy ? <LoaderCircle size={13} className="spinning"/> : <Sparkles size={13}/>} {imageBusy ? "Generating image…" : image ? "Regenerate image" : "2. Generate image"}
        </button>
        <button className="button button-outline button-sm" onClick={downloadPng} disabled={!image || imageBusy}><Download size={13}/> Download 1080 PNG</button>
      </div>
      {status && <div className="alert alert-info">{status}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <p className="form-help">Preview first, then revise the prompt or regenerate the actual image until it is approved. Generating a graphic never publishes the post; publishing still requires a separate confirmation.</p>
    </div>
  </section>;
}
