"use client";

import { useState } from "react";
import { CheckCircle2, Palette, RotateCcw, Trash2, Upload } from "lucide-react";
import type { BrandKit } from "@/lib/types";
import { DEFAULT_BRAND_KIT } from "@/lib/brand-kit";

export default function BrandKitStudio({ kit, onChange }: { kit: BrandKit; onChange: (kit: BrandKit) => void }) {
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const update = (patch: Partial<BrandKit>) => onChange({ ...kit, ...patch });
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setUploadError(""); setUploadSuccess("");
    if (file.size > 1_200_000) { setUploadError("Keep the logo under 1.2 MB so it stays light in local browser storage."); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (extension === "svg" || file.type === "image/svg+xml") {
      try {
        const source = await file.text();
        if (/<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["'](?:javascript:|https?:|\/\/)/i.test(source)) {
          setUploadError("This SVG contains active or externally linked content. Export a clean logo SVG and try again."); return;
        }
        if (!/<svg[\s>]/i.test(source)) { setUploadError("That file does not look like a valid SVG."); return; }
        update({ logoDataUrl: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source), logoName: file.name });
        setUploadSuccess("SVG logo added. It is stored in this browser only.");
      } catch { setUploadError("Could not read the SVG logo."); }
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setUploadError("Upload a PNG, JPG, WebP or clean SVG logo."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") { setUploadError("Could not read the logo."); return; }
      update({ logoDataUrl: reader.result, logoName: file.name });
      setUploadSuccess("Logo added. It is stored in this browser only.");
    };
    reader.onerror = () => setUploadError("Could not read the logo.");
    reader.readAsDataURL(file);
  };
  return <div className="workspace-content brand-kit-page">
    <div className="page-heading">
      <div><span className="eyebrow">RBF.04 / BRAND SYSTEM</span><h1>Brand Kit</h1><p>Save the visual identity for this product. Releasebuff uses it automatically when creating story graphics alongside your drafts.</p></div>
      <div className="heading-actions"><button className="button button-outline" onClick={() => { onChange(DEFAULT_BRAND_KIT); setUploadError(""); setUploadSuccess("Brand Kit reset to Releasebuff's default forest-green and lime palette."); }}><RotateCcw size={14}/> Reset defaults</button></div>
    </div>
    <div className="brand-kit-grid">
      <section className="panel">
        <div className="panel-header"><div className="row"><Palette size={17}/><span className="panel-title">Identity and colors</span></div><span className="badge badge-success"><CheckCircle2 size={12}/> Saved in browser</span></div>
        <div className="panel-body form-stack">
          <div className="brand-logo-preview">
            <div className="brand-logo-swatch" style={{ background: kit.primaryColor, color: kit.accentColor }}>
              {kit.logoDataUrl ? <img src={kit.logoDataUrl} alt="Uploaded product logo preview"/> : <span className="brand-logo-initial">R</span>}
            </div>
            <div className="grow"><strong>{kit.logoName || "Your product logo"}</strong><p className="small muted">Optional · PNG, JPG, WebP or sanitized SVG</p><label className="button button-outline button-sm" htmlFor="brandLogoUpload"><Upload size={13}/> Upload logo</label><input id="brandLogoUpload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" hidden onChange={e => { void uploadLogo(e.target.files?.[0]); e.currentTarget.value = ""; }}/>{kit.logoDataUrl && <button className="button button-ghost button-sm" onClick={() => { update({ logoDataUrl: undefined, logoName: undefined }); setUploadSuccess(""); }}><Trash2 size={13}/> Remove</button>}</div>
          </div>
          {(uploadError || uploadSuccess) && <div className={uploadError ? "alert alert-error" : "alert alert-success"}>{uploadError || uploadSuccess}</div>}
          <div className="brand-color-grid">
            <label className="brand-color-field"><span>Primary color</span><span className="brand-color-input"><input type="color" value={kit.primaryColor} onChange={e => update({ primaryColor: e.target.value.toUpperCase() })}/><code>{kit.primaryColor}</code></span></label>
            <label className="brand-color-field"><span>Accent color</span><span className="brand-color-input"><input type="color" value={kit.accentColor} onChange={e => update({ accentColor: e.target.value.toUpperCase() })}/><code>{kit.accentColor}</code></span></label>
            <label className="brand-color-field"><span>Background</span><span className="brand-color-input"><input type="color" value={kit.backgroundColor} onChange={e => update({ backgroundColor: e.target.value.toUpperCase() })}/><code>{kit.backgroundColor}</code></span></label>
            <label className="brand-color-field"><span>Text color</span><span className="brand-color-input"><input type="color" value={kit.textColor} onChange={e => update({ textColor: e.target.value.toUpperCase() })}/><code>{kit.textColor}</code></span></label>
          </div>
          <div><label className="form-label" htmlFor="brandTheme">Visual theme</label><select className="select" id="brandTheme" value={kit.theme} onChange={e => { const theme = e.target.value as BrandKit["theme"]; update({ theme, backgroundColor: theme === "dark" ? "#10251B" : "#F8F8F2", textColor: theme === "dark" ? "#F8F8F2" : "#1E2922" }); }}><option value="light">Light · warm neutral</option><option value="dark">Dark · deep forest</option></select></div>
          <div><label className="form-label" htmlFor="brandStyle">Design language</label><select className="select" id="brandStyle" value={kit.style} onChange={e => update({ style: e.target.value as BrandKit["style"] })}><option value="editorial">Editorial · clean type and open space</option><option value="technical">Technical · grid and instrumentation</option><option value="bold">Bold · stronger geometric shapes</option><option value="minimal">Minimal · restrained and quiet</option></select></div>
          <div><label className="form-label" htmlFor="brandFont">Typography</label><select className="select" id="brandFont" value={kit.fontFamily} onChange={e => update({ fontFamily: e.target.value as BrandKit["fontFamily"] })}><option value="Hanken Grotesk">Hanken Grotesk · product default</option><option value="JetBrains Mono">JetBrains Mono · technical</option><option value="Georgia">Georgia · editorial serif</option><option value="Arial">Arial · neutral sans serif</option></select></div>
          <div><label className="form-label" htmlFor="brandRatio">Default graphic ratio</label><select className="select" id="brandRatio" value={kit.aspectRatio} onChange={e => update({ aspectRatio: e.target.value as BrandKit["aspectRatio"] })}><option value="square">Square · 1:1</option><option value="landscape">Landscape · 1.91:1</option><option value="portrait">Portrait · 4:5</option></select></div>
          <label className="row small"><input type="checkbox" checked={kit.showLogo} onChange={e => update({ showLogo: e.target.checked })} style={{ accentColor: "var(--forest)" }}/> Include uploaded logo in generated graphics</label>
        </div>
      </section>
      <aside className="panel">
        <div className="panel-header"><span className="panel-title">Live brand preview</span><span className="eyebrow">RBF / VISUAL SYSTEM</span></div>
        <div className="panel-body stack">
          <div className="brand-kit-live-preview" style={{ background: kit.backgroundColor, color: kit.textColor, borderColor: kit.primaryColor }}>
            <div className="brand-kit-preview-top"><span style={{ background: kit.primaryColor, color: kit.accentColor }}>R</span><span style={{ color: kit.primaryColor }}>YOUR PRODUCT / BUILD NOTES</span></div>
            <h2 style={{ color: kit.textColor }}>A product decision worth sharing.</h2>
            <div style={{ background: kit.accentColor, width: "30%", height: 7, borderRadius: 8 }}/>
            <p style={{ color: kit.textColor }}>Make the work visible without making the story up.</p>
            <span className="brand-kit-preview-footer" style={{ borderColor: kit.primaryColor }}>STORY / EVIDENCE / CONTEXT</span>
          </div>
          <p className="form-help">These settings affect generated visuals, not Releasebuff's interface palette. The app stays in its existing forest-green, lime and warm-neutral design system.</p>
        </div>
      </aside>
    </div>
  </div>;
}
