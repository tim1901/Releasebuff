import type { BrandKit, StoryOpportunity } from "@/lib/types";

export type GifVisualType = "spotlight" | "problem" | "comparison" | "flow" | "system" | "evidence" | "takeaway";
export interface GifExplainerScene {
  kicker: string;
  title: string;
  caption: string;
  visual: GifVisualType;
  labels: string[];
}
export interface GifExplainerPlan {
  headline: string;
  subhead: string;
  scenes: GifExplainerScene[];
}
export type GifPlanMode = "claude" | "fallback";

const VISUAL_TYPES: GifVisualType[] = ["spotlight", "problem", "comparison", "flow", "system", "evidence", "takeaway"];
const clip = (value: unknown, limit: number, fallback = "") => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : fallback;
const safeColor = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function wrap(value: string, limit: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else line = candidate;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").length;
  if (consumed < words.join(" ").length && lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;:]?$/, "") + "…";
  return lines;
}
function text(lines: string[], x: number, y: number, size: number, lineHeight: number, fill: string, weight = 600, anchor = "start"): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Hanken Grotesk, Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="-0.25">${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}
function roundedRect(x: number, y: number, w: number, h: number, fill: string, stroke: string, radius = 16): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
}
function arrow(x1: number, y1: number, x2: number, y2: number, color: string): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 8;
  const ax = x2 - size * Math.cos(angle - Math.PI / 6);
  const ay = y2 - size * Math.sin(angle - Math.PI / 6);
  const bx = x2 - size * Math.cos(angle + Math.PI / 6);
  const by = y2 - size * Math.sin(angle + Math.PI / 6);
  return `<path d="M${x1} ${y1} L${x2} ${y2} M${ax} ${ay} L${x2} ${y2} L${bx} ${by}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function createFallbackGifExplainer(story?: StoryOpportunity | null, draftText = "", productName = ""): GifExplainerPlan {
  const title = clip(story?.title, 88, productName ? `A story from ${productName}` : "A story from the build");
  const summary = clip(story?.summary || draftText, 190, "A closer look at the work and the context available.");
  const facts = (story?.sourceFacts ?? []).map(value => clip(value, 120)).filter(Boolean);
  const evidenceText = facts[0] || clip(story?.evidence?.find(item => item.excerpt)?.excerpt, 140, summary);
  const question = clip(story?.requiresContext, 150);
  const category = story?.category ?? "";
  const middleVisual: GifVisualType = /decision|trade-off|problem|bug fixed|failed experiment/i.test(category)
    ? "comparison"
    : /weekly|roadmap|what's next|new feature|product improvement/i.test(category)
      ? "flow"
      : /metric|traction|milestone/i.test(category) && facts.some(fact => /\d/.test(fact))
        ? "evidence" : "system";
  return {
    headline: title,
    subhead: summary,
    scenes: [
      { kicker: "THE STORY", title, caption: summary, visual: "spotlight", labels: [clip(story?.category, 26, "Product story"), clip(productName, 28, "The build")].filter(Boolean) },
      { kicker: "THE IDEA", title: "What shaped this work", caption: clip(story?.angle, 165, summary), visual: middleVisual, labels: facts.slice(0, 3).map(fact => clip(fact, 30)).filter(Boolean) },
      { kicker: "WHAT WE KNOW", title: "The available evidence", caption: evidenceText, visual: "evidence", labels: facts.slice(0, 3).map(fact => clip(fact, 30)).filter(Boolean) },
      { kicker: question ? "STILL TO EXPLORE" : "THE TAKEAWAY", title: question ? "One question remains" : "Keep the detail in view", caption: question || clip(story?.angle, 165, summary), visual: "takeaway", labels: [clip(productName, 28, "Product context")].filter(Boolean) }
    ]
  };
}

export function parseGifExplainerPlan(value: unknown, fallback: GifExplainerPlan): GifExplainerPlan {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const scenes = rawScenes.slice(0, 4).map((item, index): GifExplainerScene | null => {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const visual = VISUAL_TYPES.includes(source.visual as GifVisualType) ? source.visual as GifVisualType : "spotlight";
    const labels = Array.isArray(source.labels) ? source.labels.filter(label => typeof label === "string").map(label => clip(label, 36)).filter(Boolean).slice(0, 4) : [];
    const title = clip(source.title, 88);
    const caption = clip(source.caption, 180);
    if (!title || !caption) return null;
    return {
      kicker: clip(source.kicker, 28, `SCENE ${index + 1}`).toUpperCase(),
      title,
      caption,
      visual,
      labels
    };
  }).filter((scene): scene is GifExplainerScene => scene !== null);
  if (scenes.length !== 4) return fallback;
  return {
    headline: clip(raw.headline, 88, fallback.headline),
    subhead: clip(raw.subhead, 180, fallback.subhead),
    scenes
  };
}

export function buildGifExplainerSvg(input: {
  kit: BrandKit;
  scene: GifExplainerScene;
  sceneIndex: number;
  sceneCount: number;
  productName: string;
  width?: number;
  height?: number;
}): string {
  const ratio = input.kit.aspectRatio;
  const width = input.width ?? 480;
  const height = input.height ?? (ratio === "landscape" ? 252 : ratio === "portrait" ? 600 : 480);
  const bg = safeColor(input.kit.backgroundColor, "#F8F8F2");
  const primary = safeColor(input.kit.primaryColor, "#173D2D");
  const accent = safeColor(input.kit.accentColor, "#C9FA78");
  const ink = safeColor(input.kit.textColor, "#1E2922");
  const dark = input.kit.theme === "dark";
  const panel = dark ? "#14251D" : "#FFFFFF";
  const muted = dark ? "#B5C7BD" : "#52685D";
  const border = dark ? "#355444" : "#DCE5D9";
  const margin = Math.round(width * 0.065);
  const scale = width / 480;
  const scene = input.scene;
  const sceneNo = String(input.sceneIndex + 1).padStart(2, "0");
  const total = String(input.sceneCount).padStart(2, "0");
  const titleSize = width > height ? 25 * scale : 29 * scale;
  const titleLines = wrap(scene.title, width > height ? 27 : 25, 3);
  const capLines = wrap(scene.caption, width > height ? 43 : 35, width > height ? 2 : 3);
  const header = `<text x="${margin}" y="${margin + 13 * scale}" font-family="JetBrains Mono, monospace" font-size="${Math.max(7, 9 * scale)}" font-weight="700" letter-spacing="1" fill="${muted}">${escapeXml(clip(input.productName, 36, "YOUR PRODUCT").toUpperCase())}</text>` +
    `<text x="${width - margin}" y="${margin + 13 * scale}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="${Math.max(7, 9 * scale)}" font-weight="600" fill="${primary}">EXPLAINER ${sceneNo}/${total}</text>` +
    `<path d="M${margin} ${margin + 24 * scale}H${width - margin}" stroke="${border}" stroke-width="1.5"/>`;
  const titleY = margin + 61 * scale;
  const heading = text(titleLines, margin, titleY, titleSize, titleSize * 1.08, ink, 780);
  const captionY = titleY + titleLines.length * titleSize * 1.08 + 10 * scale;
  const caption = text(capLines, margin, captionY, Math.max(10, 11.5 * scale), 15 * scale, muted, 450);
  const cardTop = captionY + capLines.length * 15 * scale + 18 * scale;
  const footerY = height - margin - 16 * scale;
  const cardBottom = footerY - 25 * scale;
  const cardHeight = Math.max(32 * scale, cardBottom - cardTop);
  const cardX = margin;
  const cardW = width - margin * 2;
  const labels = scene.labels.slice(0, 4);
  let art = "";
  if (scene.visual === "comparison" && cardW > 220 * scale) {
    const gap = 10 * scale;
    const half = (cardW - gap) / 2;
    const leftLabel = labels[0] || "Context";
    const rightLabel = labels[1] || labels[0] || "Change";
    const boxY = cardTop + Math.max(0, (cardHeight - 90 * scale) / 2);
    art = roundedRect(cardX, boxY, half, Math.min(105 * scale, cardHeight), panel, border) +
      roundedRect(cardX + half + gap, boxY, half, Math.min(105 * scale, cardHeight), primary, primary) +
      text(wrap(leftLabel, Math.max(8, Math.floor(half / (6 * scale))), 3), cardX + half / 2, boxY + 28 * scale, Math.max(9, 11 * scale), 13 * scale, ink, 650, "middle") +
      text(wrap(rightLabel, Math.max(8, Math.floor(half / (6 * scale))), 3), cardX + half + gap + half / 2, boxY + 28 * scale, Math.max(9, 11 * scale), 13 * scale, dark ? "#FFFFFF" : "#FFFFFF", 650, "middle") +
      arrow(cardX + half - 2 * scale, boxY + 52 * scale, cardX + half + gap + 2 * scale, boxY + 52 * scale, accent);
  } else if (scene.visual === "flow" && cardHeight > 42 * scale) {
    const count = Math.min(3, Math.max(2, labels.length || 3));
    const gap = 7 * scale;
    const itemW = (cardW - gap * (count - 1)) / count;
    const boxY = cardTop + Math.max(0, (cardHeight - 82 * scale) / 2);
    for (let i = 0; i < count; i++) {
      const x = cardX + i * (itemW + gap);
      art += roundedRect(x, boxY, itemW, Math.min(88 * scale, cardHeight), i === (input.sceneIndex % count) ? primary : panel, i === (input.sceneIndex % count) ? primary : border, 12 * scale);
      art += `<circle cx="${x + 15 * scale}" cy="${boxY + 15 * scale}" r="${7 * scale}" fill="${accent}"/>`;
      art += text(wrap(labels[i] || `Step ${i + 1}`, Math.max(8, Math.floor(itemW / (6.5 * scale))), 3), x + 8 * scale, boxY + 38 * scale, Math.max(8, 9 * scale), 10.5 * scale, i === (input.sceneIndex % count) ? (dark ? "#FFFFFF" : "#FFFFFF") : ink, 600);
      if (i < count - 1) art += arrow(x + itemW - 1 * scale, boxY + 44 * scale, x + itemW + gap + 1 * scale, boxY + 44 * scale, accent);
    }
  } else if (scene.visual === "system" && cardHeight > 40 * scale) {
    const nodes = labels.slice(0, 4);
    const cx = width / 2;
    const cy = cardTop + cardHeight / 2;
    const positions = nodes.length >= 3
      ? [{x:cx,y:cy-42*scale},{x:cx-90*scale,y:cy+30*scale},{x:cx+90*scale,y:cy+30*scale},{x:cx,y:cy+68*scale}]
      : [{x:cx-60*scale,y:cy},{x:cx+60*scale,y:cy}];
    positions.slice(0, Math.max(2, nodes.length)).forEach((pos, i) => {
      if (i < positions.length - 1) art += arrow(pos.x, pos.y, positions[i+1].x, positions[i+1].y, border);
    });
    nodes.forEach((label, i) => {
      const pos = positions[i % positions.length];
      art += `<circle cx="${pos.x}" cy="${pos.y}" r="${19*scale}" fill="${i === input.sceneIndex % Math.max(1,nodes.length) ? accent : primary}" stroke="${border}" stroke-width="2"/>`;
      art += text(wrap(label, 15, 2), pos.x, pos.y + 31 * scale, Math.max(7, 8 * scale), 9 * scale, ink, 600, "middle");
    });
  } else if (scene.visual === "problem" && cardHeight > 40 * scale) {
    const centerY = cardTop + cardHeight / 2;
    const leftW = cardW * 0.34;
    art = roundedRect(cardX, centerY - 27 * scale, leftW, 54 * scale, panel, border) +
      `<circle cx="${cardX + 15*scale}" cy="${centerY}" r="${5*scale}" fill="${accent}"/>` +
      text(wrap(labels[0] || "Constraint", 14, 2), cardX + 28 * scale, centerY - 3 * scale, Math.max(8, 10 * scale), 11 * scale, ink, 600) +
      arrow(cardX + leftW + 5 * scale, centerY, cardX + leftW + 40 * scale, centerY, accent) +
      roundedRect(cardX + leftW + 46 * scale, centerY - 30 * scale, cardW - leftW - 46 * scale, 60 * scale, primary, primary) +
      text(wrap(labels[1] || "Next step", 19, 2), cardX + leftW + 58 * scale, centerY - 4 * scale, Math.max(8, 11 * scale), 12 * scale, "#FFFFFF", 650);
  } else if (scene.visual === "evidence" && cardHeight > 35 * scale) {
    const rows = labels.slice(0, 3);
    art = rows.map((label, i) => {
      const y = cardTop + i * Math.min(48 * scale, cardHeight / Math.max(1, rows.length));
      const w = cardW - 5 * scale;
      return roundedRect(cardX, y, w, 36 * scale, i === 0 ? (dark ? "#223E2F" : "#EDF5E6") : panel, border, 10 * scale) +
        `<circle cx="${cardX + 15*scale}" cy="${y + 18*scale}" r="${5*scale}" fill="${accent}"/>` +
        text(wrap(label, Math.max(8, Math.floor((w - 34*scale)/(6*scale))), 2), cardX + 28*scale, y + 14*scale, Math.max(8, 9.5*scale), 11*scale, ink, 600);
    }).join("");
    if (!rows.length) art = roundedRect(cardX, cardTop + 10 * scale, cardW, Math.min(70 * scale, cardHeight - 5 * scale), panel, border);
  } else if (scene.visual === "takeaway" && cardHeight > 36 * scale) {
    art = roundedRect(cardX, cardTop + 5 * scale, cardW, Math.min(cardHeight - 10 * scale, 106 * scale), primary, primary, 18 * scale) +
      text(wrap(labels[0] || scene.caption, Math.max(16, Math.floor(cardW / (7.5 * scale))), 3), cardX + 18 * scale, cardTop + 34 * scale, Math.max(10, 14 * scale), 17 * scale, "#FFFFFF", 650);
  } else {
    const nodeCount = Math.min(3, Math.max(1, labels.length));
    const gap = 8 * scale;
    const itemW = (cardW - gap * (nodeCount - 1)) / nodeCount;
    const y = cardTop + Math.max(0, (cardHeight - 60 * scale) / 2);
    for (let i = 0; i < nodeCount; i++) {
      const x = cardX + i * (itemW + gap);
      art += roundedRect(x, y, itemW, Math.min(65 * scale, cardHeight), i === 0 ? primary : panel, border, 14 * scale);
      art += text(wrap(labels[i] || (i === 0 ? "Context" : "Detail"), Math.max(8, Math.floor(itemW / (7*scale))), 3), x + 9 * scale, y + 23 * scale, Math.max(8, 10 * scale), 12 * scale, i === 0 ? "#FFFFFF" : ink, 600);
    }
  }
  const progressBarY = height - margin - 5 * scale;
  const progressW = width - margin * 2;
  const progress = (input.sceneIndex + 1) / Math.max(1, input.sceneCount);
  const backgroundGrid = input.kit.style === "technical"
    ? Array.from({length: 10}, (_, index) => `<path d="M${index * width / 9} 0V${height}" stroke="${primary}" opacity="0.05"/>`).join("")
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="${bg}"/>` + backgroundGrid
    + `<circle cx="${width - margin * 0.6}" cy="${height * 0.21}" r="${38*scale}" fill="${accent}" opacity="0.12"/>`
    + header + heading + caption + art
    + `<rect x="${margin}" y="${progressBarY}" width="${progressW}" height="${4*scale}" rx="${2*scale}" fill="${border}"/>`
    + `<rect x="${margin}" y="${progressBarY}" width="${progressW * progress}" height="${4*scale}" rx="${2*scale}" fill="${accent}"/>`
    + `<text x="${margin}" y="${height - margin + 10*scale}" fill="${muted}" font-family="JetBrains Mono, monospace" font-size="${Math.max(7,8*scale)}">SCENE ${sceneNo} OF ${total}</text>`
    + "</svg>";
}
