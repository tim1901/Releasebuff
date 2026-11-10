"use client";

import { CheckCircle2, Palette, RotateCcw } from "lucide-react";
import type { BrandKit } from "@/lib/types";
import { DEFAULT_BRAND_KIT } from "@/lib/brand-kit";

export default function BrandKitStudio({ kit, onChange }: { kit: BrandKit; onChange: (kit: BrandKit) => void }) {
  const update = (patch: Partial<BrandKit>) => onChange({ ...kit, ...patch });
  return <div className="workspace-content brand-kit-page">
    <div className="page-heading">
      <div><span className="eyebrow">RBF.04 / BRAND SYSTEM</span><h1>Brand Kit</h1><p>Set the visual identity used for graphics created alongside your drafts. Generated graphics use a typographic product-name signature, never a logo.</p></div>
      <div className="heading-actions"><button className="button button-outline" onClick={() => onChange(DEFAULT_BRAND_KIT)}><RotateCcw size={14}/> Reset defaults</button></div>
    </div>
    <div className="brand-kit-grid">
      <section className="panel">
        <div className="panel-header"><div className="row"><Palette size={17}/><span className="panel-title">Colors and typography</span></div><span className="badge badge-success"><CheckCircle2 size={12}/> Saved in browser</span></div>
        <div className="panel-body form-stack">
          <div className="brand-color-grid">
            <label className="brand-color-field"><span>Primary color</span><span className="brand-color-input"><input type="color" value={kit.primaryColor} onChange={e => update({ primaryColor: e.target.value.toUpperCase() })}/><code>{kit.primaryColor}</code></span></label>
            <label className="brand-color-field"><span>Accent color</span><span className="brand-color-input"><input type="color" value={kit.accentColor} onChange={e => update({ accentColor: e.target.value.toUpperCase() })}/><code>{kit.accentColor}</code></span></label>
            <label className="brand-color-field"><span>Background</span><span className="brand-color-input"><input type="color" value={kit.backgroundColor} onChange={e => update({ backgroundColor: e.target.value.toUpperCase() })}/><code>{kit.backgroundColor}</code></span></label>
            <label className="brand-color-field"><span>Text color</span><span className="brand-color-input"><input type="color" value={kit.textColor} onChange={e => update({ textColor: e.target.value.toUpperCase() })}/><code>{kit.textColor}</code></span></label>
          </div>
          <div><label className="form-label" htmlFor="brandTheme">Visual theme</label><select className="select" id="brandTheme" value={kit.theme} onChange={e => { const theme = e.target.value as BrandKit["theme"]; update({ theme, backgroundColor: theme === "dark" ? "#10251B" : "#F8F8F2", textColor: theme === "dark" ? "#F8F8F2" : "#1E2922" }); }}><option value="light">Light · warm neutral</option><option value="dark">Dark · deep forest</option></select></div>
          <div><label className="form-label" htmlFor="brandStyle">Design language</label><select className="select" id="brandStyle" value={kit.style} onChange={e => update({ style: e.target.value as BrandKit["style"] })}><option value="editorial">Editorial · clean type and open space</option><option value="technical">Technical · grid and instrumentation</option><option value="bold">Bold · strong geometry and contrast</option><option value="minimal">Minimal · restrained and quiet</option></select></div>
          <div><label className="form-label" htmlFor="brandFont">Typography</label><select className="select" id="brandFont" value={kit.fontFamily} onChange={e => update({ fontFamily: e.target.value as BrandKit["fontFamily"] })}><option value="Hanken Grotesk">Hanken Grotesk · product default</option><option value="JetBrains Mono">JetBrains Mono · technical</option><option value="Georgia">Georgia · editorial serif</option><option value="Arial">Arial · neutral sans serif</option></select></div>
          <div><label className="form-label" htmlFor="brandRatio">Default graphic ratio</label><select className="select" id="brandRatio" value={kit.aspectRatio} onChange={e => update({ aspectRatio: e.target.value as BrandKit["aspectRatio"] })}><option value="square">Square · 1:1</option><option value="landscape">Landscape · 1.91:1</option><option value="portrait">Portrait · 4:5</option></select></div>
          <p className="form-help">The product name appears as text in the graphic. No logo or brand mark is added, so the story itself remains the focus.</p>
        </div>
      </section>
      <aside className="panel">
        <div className="panel-header"><span className="panel-title">Live brand preview</span><span className="eyebrow">TYPE / COLOR / HIERARCHY</span></div>
        <div className="panel-body stack">
          <div className="brand-kit-live-preview" style={{ background: kit.backgroundColor, color: kit.textColor, borderColor: kit.primaryColor }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid " + kit.primaryColor + "33", paddingBottom: 14 }}>
              <span style={{ color: kit.primaryColor, fontSize: 18, fontWeight: 800, letterSpacing: "-.04em" }}>YOUR PRODUCT</span>
              <span style={{ color: kit.primaryColor, fontSize: 10, letterSpacing: ".12em" }}>BUILD NOTES</span>
            </div>
            <h2 style={{ color: kit.textColor, marginTop: 28 }}>A decision worth sharing.</h2>
            <div style={{ background: kit.accentColor, width: "38%", height: 7, borderRadius: 8 }}/>
            <p style={{ color: kit.textColor }}>Specific work. Real evidence. A story people can follow.</p>
            <span className="brand-kit-preview-footer" style={{ borderColor: kit.primaryColor }}>STORY / EVIDENCE / CONTEXT</span>
          </div>
          <p className="form-help">Brand Kit settings change generated graphics, not Releasebuff&apos;s interface palette. The app stays in its existing forest-green, lime and warm-neutral design system.</p>
        </div>
      </aside>
    </div>
  </div>;
}
