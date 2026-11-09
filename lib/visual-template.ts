import type { BrandKit, StoryOpportunity } from "@/lib/types";

export type VisualLayout = "spotlight" | "lesson" | "weekly";

export function getVisualDimensions(ratio: BrandKit["aspectRatio"], width?: number): { width: number; height: number } {
  const w = width ?? (ratio === "landscape" ? 1200 : 1080);
  const h = ratio === "landscape" ? Math.round(w * 0.525) : ratio === "portrait" ? Math.round(w * 1.25) : w;
  return { width: w, height: h };
}
function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function wrapWords(value: string, limit: number, maxLines: number): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  let consumed = 0;
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (candidate.length > limit && line) {
      lines.push(line); consumed += line.length + 1; line = word;
      if (lines.length === maxLines) break;
    } else line = candidate;
  }
  if (line && lines.length < maxLines) { lines.push(line); consumed += line.length; }
  if (consumed < normalized.length && lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;:]?$/, "") + "…";
  return lines;
}
function textLines(lines: string[], x: number, y: number, lineHeight: number, fontSize: number, fill: string, font: string, weight: number): string {
  return "<text x=\"" + x + "\" y=\"" + y + "\" fill=\"" + fill + "\" font-family=\"" + escapeXml(font) + "\" font-size=\"" + fontSize + "\" font-weight=\"" + weight + "\" letter-spacing=\"-1.2\">" +
    lines.map((line, index) => "<tspan x=\"" + x + "\" dy=\"" + (index === 0 ? 0 : lineHeight) + "\">" + escapeXml(line) + "</tspan>").join("") + "</text>";
}
export function buildStoryVisualSvg(input: {
  kit: BrandKit;
  story?: StoryOpportunity | null;
  draftText?: string;
  productName?: string;
  headlineOverride?: string;
  supportingLineOverride?: string;
  layout?: VisualLayout;
  width?: number;
  height?: number;
  motionProgress?: number;
}): string {
  const kit = input.kit;
  const dimensions = getVisualDimensions(kit.aspectRatio, input.width);
  const width = dimensions.width;
  const height = input.height ?? dimensions.height;
  const margin = Math.round(width * 0.07);
  const background = safeColor(kit.backgroundColor, "#F8F8F2");
  const primary = safeColor(kit.primaryColor, "#173D2D");
  const accent = safeColor(kit.accentColor, "#C9FA78");
  const ink = safeColor(kit.textColor, "#1E2922");
  const panel = kit.theme === "dark" ? "#20392C" : "#FFFFFF";
  const font = ["Hanken Grotesk", "JetBrains Mono", "Georgia", "Arial"].includes(kit.fontFamily) ? kit.fontFamily : "Hanken Grotesk";
  const layout = input.layout ?? "spotlight";
  const draft = (input.draftText ?? "").trim();
  const firstDraftLine = draft.split(/\n|[.!?]/).map(part => part.trim()).find(Boolean) ?? "";
  const headline = (input.headlineOverride || input.story?.title || firstDraftLine || "A story from this build").trim().slice(0, 140);
  const supporting = (input.supportingLineOverride || input.story?.summary || draft.replace(/\s+/g, " ").slice(0, 250) || "A small, specific look at the work behind the product.").trim().slice(0, 300);
  const titleLines = wrapWords(headline, width > height ? 26 : 23, 3);
  const supportingLines = wrapWords(supporting, width > height ? 62 : 42, width > height ? 2 : 3);
  const headlineSize = width > height ? 58 : 66;
  const titleY = Math.round(width > height ? height * 0.31 : margin + 190);
  const lineHeight = Math.round(headlineSize * 1.12);
  const titleBottom = titleY + Math.max(1, titleLines.length) * lineHeight;
  const ruleY = titleBottom + 28;
  const supportingY = ruleY + 58;
  const supportingSize = width > height ? 22 : 26;
  const supportingLineHeight = Math.round(supportingSize * 1.45);
  const footerY = height - margin - 30;
  const label = layout === "weekly" ? "BUILD RECAP" : layout === "lesson" ? "DECISION / LESSON" : (input.story?.category || "PRODUCT UPDATE").toUpperCase();
  const brandName = (input.productName || "YOUR PRODUCT").toUpperCase().slice(0, 50);
  const progress = Math.max(0, Math.min(1, input.motionProgress ?? 0.35));
  const barWidth = Math.round(width * (0.18 + progress * 0.16));
  const anim = input.motionProgress === undefined ? "<animate attributeName=\"width\" values=\"" + Math.round(width * 0.18) + ";" + Math.round(width * 0.34) + ";" + Math.round(width * 0.22) + "\" dur=\"1.6s\" repeatCount=\"indefinite\"/>" : "";
  const isTechnical = kit.style === "technical";
  const isBold = kit.style === "bold";
  const isMinimal = kit.style === "minimal";
  const decoration = isTechnical
    ? "<g stroke=\"" + primary + "\" stroke-width=\"1\" opacity=\".09\">" + Array.from({length: 12}, (_, i) => "<path d=\"M" + (margin + i * Math.round((width - margin * 2) / 12)) + " 0V" + height + "\"/>").join("") + Array.from({length: Math.ceil(height / 80)}, (_, i) => "<path d=\"M0 " + (i * 80) + "H" + width + "\"/>").join("") + "</g>"
    : isMinimal ? "" : "<circle cx=\"" + Math.round(width - margin * 0.5) + "\" cy=\"" + Math.round(height * 0.68) + "\" r=\"" + Math.round(width * 0.19) + "\" fill=\"" + accent + "\" opacity=\"" + (isBold ? ".24" : ".13") + "\"/>";
  const logo = kit.showLogo && kit.logoDataUrl
    ? "<image href=\"" + escapeXml(kit.logoDataUrl) + "\" x=\"" + (width - margin - 88) + "\" y=\"" + (margin - 2) + "\" width=\"72\" height=\"72\" preserveAspectRatio=\"xMidYMid meet\"/>"
    : "<g><rect x=\"" + margin + "\" y=\"" + (margin - 4) + "\" width=\"48\" height=\"48\" rx=\"12\" fill=\"" + primary + "\"/><path d=\"M8 8H25C33 8 38 13 38 21C38 27 34 31 29 33L37 40H26L20 34H17V40H8Z\" transform=\"translate(" + (margin + 5) + " " + (margin + 2) + ") scale(.8)\" fill=\"" + accent + "\"/></g>";
  const labelX = kit.showLogo && kit.logoDataUrl ? margin : margin + 62;
  const labelY = margin + 82;
  const titleMarkup = textLines(titleLines, margin, titleY, lineHeight, headlineSize, ink, font, isBold ? 800 : 700);
  const supportingMarkup = textLines(supportingLines, margin, supportingY, supportingLineHeight, supportingSize, ink, font, 450);
  const layoutTag = layout === "weekly" ? "WEEKLY BUILD" : layout === "lesson" ? "THE REASONING" : "THE BUILD";
  return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\" viewBox=\"0 0 " + width + " " + height + "\" role=\"img\" aria-label=\"" + escapeXml(headline) + "\">" +
    "<defs><linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0%\" stop-color=\"" + background + "\"/><stop offset=\"100%\" stop-color=\"" + panel + "\"/></linearGradient></defs>" +
    "<rect width=\"100%\" height=\"100%\" fill=\"url(#bg)\"/>" + decoration +
    (isBold ? "<path d=\"M0 0H" + Math.round(width * 0.28) + "L0 " + Math.round(height * 0.3) + "Z\" fill=\"" + primary + "\" opacity=\".08\"/>" : "") +
    logo +
    "<text x=\"" + labelX + "\" y=\"" + labelY + "\" fill=\"" + primary + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(13, Math.round(width * 0.016)) + "\" font-weight=\"600\" letter-spacing=\"2\">" + escapeXml(label) + "</text>" +
    "<text x=\"" + labelX + "\" y=\"" + (labelY + 28) + "\" fill=\"" + ink + "\" opacity=\".58\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(12, Math.round(width * 0.013)) + "\" letter-spacing=\"1.3\">" + escapeXml(brandName) + "</text>" +
    titleMarkup +
    "<rect x=\"" + margin + "\" y=\"" + ruleY + "\" width=\"" + barWidth + "\" height=\"" + Math.max(7, Math.round(width * 0.009)) + "\" rx=\"6\" fill=\"" + accent + "\">" + anim + "</rect>" +
    supportingMarkup +
    "<path d=\"M" + margin + " " + (footerY - 28) + "H" + (width - margin) + "\" stroke=\"" + primary + "\" opacity=\".17\"/>" +
    "<text x=\"" + margin + "\" y=\"" + footerY + "\" fill=\"" + primary + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(11, Math.round(width * 0.012)) + "\" letter-spacing=\"1.4\">" + escapeXml(layoutTag) + " / " + escapeXml((input.productName || "RELEASEBUFF").toUpperCase().slice(0, 30)) + "</text>" +
    "<circle cx=\"" + (width - margin - 5) + "\" cy=\"" + (footerY - 4) + "\" r=\"7\" fill=\"" + accent + "\"/><circle cx=\"" + (width - margin - 5) + "\" cy=\"" + (footerY - 4) + "\" r=\"3\" fill=\"" + primary + "\"/>" +
    "</svg>";
}
