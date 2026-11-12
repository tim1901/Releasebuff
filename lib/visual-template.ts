import type { BrandKit, StoryOpportunity } from "@/lib/types";
export type PlannedVisualLayout = "spotlight" | "release" | "metric" | "decision" | "lesson" | "steps";
export type VisualLayout = "auto" | PlannedVisualLayout;
export interface StoryVisualPlan { layout: PlannedVisualLayout; headline: string; supportingLine: string; factIndexes: number[]; metricFactIndex: number | null; }

export function getVisualDimensions(ratio: BrandKit["aspectRatio"], width?: number): { width: number; height: number } {
  const w = width ?? (ratio === "landscape" ? 1200 : 1080);
  const h = ratio === "landscape" ? Math.round(w * 0.525) : ratio === "portrait" ? Math.round(w * 1.25) : w;
  return { width: w, height: h };
}
function safeColor(value: string, fallback: string): string { return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback; }
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function wrapWords(value: string, limit: number, maxLines: number): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || maxLines < 1) return [];
  const safeLimit = Math.max(1, Math.floor(limit));
  const words = normalized.split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let truncated = false;

  // Split long unbroken tokens so they cannot push SVG text outside the canvas.
  const splitLongWord = (word: string): string[] => {
    const chunks: string[] = [];
    for (let i = 0; i < word.length; i += safeLimit) chunks.push(word.slice(i, i + safeLimit));
    return chunks;
  };

  for (const originalWord of words) {
    const chunks = originalWord.length > safeLimit ? splitLongWord(originalWord) : [originalWord];
    for (const word of chunks) {
      const candidate = line ? line + " " + word : word;
      if (candidate.length > safeLimit && line) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      } else {
        line = candidate;
      }
    }
    if (truncated) break;
  }

  if (!truncated && line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }
  const consumedText = lines.join(" ").replace(/…$/, "");
  if (truncated || consumedText.length < normalized.length) {
    const last = lines.length - 1;
    if (last >= 0) lines[last] = lines[last].replace(/[\s.,;:!?-]+$/, "") + "…";
  }
  return lines.slice(0, maxLines);
}
function textMarkup(lines: string[], x: number, y: number, lineHeight: number, fontSize: number, fill: string, font: string, weight: number, letterSpacing = -0.6, maxWidth?: number): string {
  return "<text x=\\"" + x + "\\" y=\\"" + y + "\\" fill=\\"" + fill + "\\" font-family=\\"" + escapeXml(font) + "\\" font-size=\\"" + fontSize + "\\" font-weight=\\"" + weight + "\\" letter-spacing=\\"" + letterSpacing + "\\">" +
    lines.map((line, index) => {
      // SVG does not wrap text automatically. Constrain each rendered line to its real
      // column width as a final guard against font-metric differences between preview/export.
      const estimatedWidth = line.length * fontSize * 0.72;
      const fit = maxWidth && estimatedWidth > maxWidth
        ? " textLength=\\"" + maxWidth + "\\" lengthAdjust=\\"spacingAndGlyphs\\""
        : "";
      return "<tspan x=\\"" + x + "\\" dy=\\"" + (index === 0 ? 0 : lineHeight) + "\\"" + fit + ">" + escapeXml(line) + "</tspan>";
    }).join("") + "</text>";
}
function rect(x: number, y: number, w: number, h: number, fill: string, radius: number, stroke?: string): string {
  return "<rect x=\"" + x + "\" y=\"" + y + "\" width=\"" + Math.max(1, w) + "\" height=\"" + Math.max(1, h) + "\" rx=\"" + radius + "\" fill=\"" + fill + "\"" + (stroke ? " stroke=\"" + stroke + "\" stroke-width=\"1.5\"" : "") + "/>";
}
function safeSnippet(value: string, max = 230): string { return value.replace(/\s+/g, " ").trim().slice(0, max); }

export function getVisualFacts(story?: StoryOpportunity | null, draftText = ""): string[] {
  const draftFacts = draftText
    .split(/\n+|(?<=[.!?])\s+/)
    .map(value => safeSnippet(value.replace(/^[-*•\d.)\s]+/, ""), 230))
    .filter(value => value.length >= 24)
    .slice(0, 5);
  const storyFacts = story ? [
    ...(Array.isArray(story.sourceFacts) ? story.sourceFacts : []),
    ...(Array.isArray(story.evidence) ? story.evidence.filter(Boolean).map(item => item.excerpt?.trim() || "") : [])
  ] : [];
  // The actual post leads the composition; profile/evidence facts fill gaps rather than overpowering it.
  const sources = [...draftFacts, ...storyFacts];
  const seen = new Set<string>();
  return sources.map(value => safeSnippet(typeof value === "string" ? value : "")).filter(value => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}
export interface MetricDetails { value: string; unit: string; fact: string; }
export function extractMetricDetails(fact: string): MetricDetails | null {
  const match = fact.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(%|percent|x faster|x|ms|milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|commits?|milestones?|versions?|features?|bugs?|users?|customers?|requests?|tests?|releases?|issues?|pull requests?|meetings?|deployments?|integrations?|workflows?|builds?|downloads?|signups?|subscribers?)\b/i);
  if (!match) return null;
  return { value: match[1], unit: match[2].toLowerCase(), fact };
}
function looksLikeRawIdentifier(value: string): boolean {
  const compact = value.trim();
  if (!compact || compact.length > 72) return false;
  return !/\s/.test(compact) && (/@v?\d/i.test(compact) || /^v?\d+\.\d+(?:\.\d+)?(?:-[\w.-]+)?$/i.test(compact) || /^[a-z0-9_.:/-]+#[0-9a-f]{6,}$/i.test(compact));
}
function humanHeadline(story?: StoryOpportunity | null, productName?: string): string {
  const title = story?.title?.trim() ?? "";
  if (title && !looksLikeRawIdentifier(title)) return title;
  const category = story?.category ?? "";
  if (category === "Weekly build recap") return "What moved forward this week";
  if (category === "New feature shipped") return "A release worth unpacking";
  if (category === "Product improvement") return "A product change worth sharing";
  if (category === "Traction and milestones") return "A milestone worth measuring";
  if (category === "Technical decision / trade-off") return "A decision behind the build";
  if (category === "Bug fixed / problem solved") return "The problem, and what changed";
  if (category === "Lesson learned") return "A lesson from the build";
  if (category === "Failed experiment / changed direction") return "An experiment changed direction";
  if (category === "Product showcase / demo") return "Inside the product";
  if (category === "Customer feedback and learning") return "What the feedback taught us";
  if (category === "What's next / roadmap") return "What comes next";
  if (category === "Founder journey / personal reflection") return "A moment in the build";
  return productName?.trim() ? "The work behind " + productName.trim().slice(0, 32) : "The work behind the product";
}
function inferLayout(story: StoryOpportunity | null | undefined, facts: string[]): { layout: PlannedVisualLayout; metricFactIndex: number | null } {
  const category = story?.category?.toLowerCase() ?? "";
  const metricIndex = facts.findIndex(fact => Boolean(extractMetricDetails(fact)));
  const evidenceTypes = (story?.evidence ?? []).map(item => item.type).join(" ").toLowerCase();
  const context = [story?.title, story?.summary, story?.angle, ...facts].filter(Boolean).join(" ").toLowerCase();
  if ((category.includes("traction") || category.includes("milestone")) && metricIndex >= 0) return { layout: "metric", metricFactIndex: metricIndex };
  if (/weekly build recap|what's next|roadmap/.test(category)) return { layout: "steps", metricFactIndex: null };
  if (/technical decision|trade-off|bug fixed|problem solved|failed experiment|changed direction|problem and solution/.test(category)) return { layout: "decision", metricFactIndex: null };
  if (/lesson learned|customer feedback|founder journey|personal reflection/.test(category)) return { layout: "lesson", metricFactIndex: null };
  if (/new feature shipped|product improvement|product showcase|launch promotion/.test(category)) return { layout: "release", metricFactIndex: null };
  if (metricIndex >= 0 && (evidenceTypes.includes("analytics") || /\b(metrics?|usage|commit history|activity count|performance)\b/.test(context))) return { layout: "metric", metricFactIndex: metricIndex };
  if (facts.length >= 3 && /release|shipped|launched|changelog/.test(context)) return { layout: "release", metricFactIndex: null };
  return { layout: "spotlight", metricFactIndex: null };
}
export function createContextualVisualPlan(input: { story?: StoryOpportunity | null; draftText?: string; productName?: string }): StoryVisualPlan {
  const facts = getVisualFacts(input.story, input.draftText);
  const inferred = inferLayout(input.story, facts);
  const draftLead = (input.draftText ?? "").split(/\n+|(?<=[.!?])\s+/).map(value => value.trim()).find(Boolean) ?? "";
  const supportingLine = safeSnippet(draftLead || input.story?.summary || "", 220) || "A closer look at the work, grounded in the details available.";
  let factIndexes = facts.map((_, index) => index).slice(0, 3);
  if (inferred.layout === "metric" && inferred.metricFactIndex !== null) factIndexes = [inferred.metricFactIndex];
  if (inferred.layout === "lesson") factIndexes = facts.length ? [0, ...facts.slice(1, 2).map((_, index) => index + 1)] : [];
  return { layout: inferred.layout, headline: humanHeadline(input.story, input.productName), supportingLine, factIndexes, metricFactIndex: inferred.metricFactIndex };
}
function categoryLabel(story: StoryOpportunity | null | undefined, layout: PlannedVisualLayout): string {
  if (layout === "metric") return "PROGRESS / IN NUMBERS";
  if (layout === "release") return "SHIPPED / PRODUCT NOTES";
  if (layout === "decision") return "ENGINEERING / THE TRADE-OFF";
  if (layout === "lesson") return "BUILD NOTES / THE TAKEAWAY";
  if (layout === "steps") return "IN THE BUILD / KEY MOVES";
  return (story?.category || "PRODUCT STORY").toUpperCase().slice(0, 42);
}
function buildFactRows(input: { facts: string[]; x: number; y: number; width: number; height: number; font: string; ink: string; primary: string; accent: string; panel: string; scale: number; }): string {
  const { facts, x, y, width, height, font, ink, primary, accent, panel, scale } = input;
  if (!facts.length || height < 24 * scale) return "";
  const count = Math.min(3, facts.length, Math.max(1, Math.floor(height / (72 * scale))));
  const gap = 10 * scale;
  const rowHeight = (height - (count - 1) * gap) / count;
  return facts.slice(0, count).map((fact, index) => {
    const top = y + index * (rowHeight + gap);
    const fill = index === 0 ? panel : (index % 2 === 0 ? panel : "transparent");
    const outline = primary + (index === 0 ? "44" : "22");
    const badgeSize = 15 * scale;
    const textX = x + 46 * scale;
    const fontSize = Math.max(13, 19 * scale);
    const maxChars = Math.max(18, Math.floor((width - 68 * scale) / (fontSize * 0.66)));
    const factLines = wrapWords(fact, maxChars, rowHeight < 62 * scale ? 1 : 2);
    const firstBaseline = top + (rowHeight - factLines.length * fontSize * 1.22) / 2 + fontSize;
    const badge = "<circle cx=\"" + (x + 23 * scale) + "\" cy=\"" + (top + rowHeight / 2) + "\" r=\"" + badgeSize + "\" fill=\"" + accent + "\"/><text x=\"" + (x + 23 * scale) + "\" y=\"" + (top + rowHeight / 2 + 5 * scale) + "\" text-anchor=\"middle\" fill=\"" + primary + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(10, 12 * scale) + "\" font-weight=\"700\">" + String(index + 1).padStart(2, "0") + "</text>";
    return rect(x, top, width, rowHeight, fill, 17 * scale, outline) + badge + textMarkup(factLines, textX, firstBaseline, fontSize * 1.22, fontSize, ink, font, 550, -0.1);
  }).join("");
}
export function buildStoryVisualSvg(input: { kit: BrandKit; story?: StoryOpportunity | null; draftText?: string; productName?: string; headlineOverride?: string; supportingLineOverride?: string; layout?: VisualLayout; visualPlan?: StoryVisualPlan | null; width?: number; height?: number; motionProgress?: number; }): string {
  const kit = input.kit;
  const dimensions = getVisualDimensions(kit.aspectRatio, input.width);
  const width = dimensions.width;
  const height = input.height ?? dimensions.height;
  const margin = Math.round(width * 0.065);
  const scale = width < 600 ? 0.6 : width / 1080;
  const background = safeColor(kit.backgroundColor, "#F8F8F2");
  const primary = safeColor(kit.primaryColor, "#173D2D");
  const accent = safeColor(kit.accentColor, "#C9FA78");
  const ink = safeColor(kit.textColor, "#1E2922");
  const panel = kit.theme === "dark" ? "#14251D" : "#FFFFFF";
  const muted = kit.theme === "dark" ? "#B5C7BD" : "#52685D";
  const font = ["Hanken Grotesk", "JetBrains Mono", "Georgia", "Arial"].includes(kit.fontFamily) ? kit.fontFamily : "Hanken Grotesk";
  const facts = getVisualFacts(input.story, input.draftText);
  const plan = input.visualPlan ?? createContextualVisualPlan(input);
  let layout: PlannedVisualLayout = (input.layout ?? "auto") === "auto" ? plan.layout : input.layout as PlannedVisualLayout;
  const metricIndex = plan.metricFactIndex !== null && facts[plan.metricFactIndex] ? plan.metricFactIndex : facts.findIndex(fact => Boolean(extractMetricDetails(fact)));
  const metric = metricIndex >= 0 ? extractMetricDetails(facts[metricIndex]) : null;
  if (layout === "metric" && !metric) layout = plan.layout === "metric" ? "spotlight" : plan.layout;
  const headline = safeSnippet(input.headlineOverride?.trim() || plan.headline || humanHeadline(input.story, input.productName), 100);
  const supporting = safeSnippet(input.supportingLineOverride?.trim() || plan.supportingLine || input.story?.summary || input.draftText || "", 240);
  const titleSize = Math.max(28, Math.round((width > height ? 58 : 64) * scale));
  const titleLineHeight = titleSize * 1.08;
  const titleChars = Math.max(14, Math.floor((width - margin * 2) / (titleSize * 0.72)));
  const titleLines = wrapWords(headline, titleChars, 3);
  const titleY = margin + 124 * scale;
  const titleBottom = titleY + Math.max(1, titleLines.length) * titleLineHeight;
  const supportSize = Math.max(15, Math.round(21 * scale));
  const supportLines = wrapWords(supporting, Math.max(20, Math.floor((width - margin * 2) / (supportSize * 0.66))), width > height ? 2 : 3);
  const supportY = titleBottom + 30 * scale;
  const supportLineHeight = supportSize * 1.38;
  const contentY = supportY + Math.max(1, supportLines.length) * supportLineHeight + 30 * scale;
  const footerY = height - margin - 12 * scale;
  const contentBottom = footerY - 32 * scale;
  const contentHeight = Math.max(30 * scale, contentBottom - contentY);
  const indexes = plan.factIndexes.length ? plan.factIndexes : facts.map((_, index) => index).slice(0, 3);
  const visibleFacts = indexes.filter((index, position) => Number.isInteger(index) && facts[index] && indexes.indexOf(index) === position).map(index => facts[index]).slice(0, 4);
  const label = categoryLabel(input.story, layout);
  const progress = Math.max(0, Math.min(1, input.motionProgress ?? 0.38));
  const accentWidth = Math.round(width * (0.12 + progress * 0.09));
  const accentAnimation = input.motionProgress === undefined ? "<animate attributeName=\"width\" values=\"" + Math.round(width * 0.12) + ";" + Math.round(width * 0.21) + ";" + Math.round(width * 0.15) + "\" dur=\"1.8s\" repeatCount=\"indefinite\"/>" : "";
  const bgGrid = kit.style === "technical" ? "<g stroke=\"" + primary + "\" stroke-width=\"1\" opacity=\".07\">" + Array.from({length: 12}, (_, index) => "<path d=\"M" + (index * Math.round(width / 11)) + " 0V" + height + "\"/>").join("") + Array.from({length: Math.ceil(height / (64 * scale))}, (_, index) => "<path d=\"M0 " + Math.round(index * 64 * scale) + "H" + width + "\"/>").join("") + "</g>" : "";
  const productSignature = escapeXml((input.productName || "Your product").trim().slice(0, 50));
  const header = "<text x=\"" + margin + "\" y=\"" + (margin + 24 * scale) + "\" fill=\"" + primary + "\" font-family=\"" + escapeXml(font) + "\" font-size=\"" + Math.max(15, 23 * scale) + "\" font-weight=\"750\" letter-spacing=\".2\">" + productSignature + "</text>" +
    "<text x=\"" + (width - margin) + "\" y=\"" + (margin + 23 * scale) + "\" text-anchor=\"end\" fill=\"" + muted + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(10, 12 * scale) + "\" font-weight=\"600\" letter-spacing=\"1\">" + escapeXml(label.slice(0, 42)) + "</text>" +
    "<path d=\"M" + margin + " " + (margin + 46 * scale) + "H" + (width - margin) + "\" stroke=\"" + primary + "\" opacity=\".22\"/>";
  const heading = textMarkup(titleLines, margin, titleY, titleLineHeight, titleSize, ink, font, kit.style === "bold" ? 820 : 740, -1.25 * scale, width - margin * 2);
  const supportingMarkup = textMarkup(supportLines, margin, supportY, supportLineHeight, supportSize, muted, font, 480, -0.15, width - margin * 2);
  let content = "";
  if (layout === "metric" && metric) {
    const cardHeight = Math.min(290 * scale, contentHeight * 0.82);
    const cardY = contentY + Math.max(0, (contentHeight - cardHeight) * 0.08);
    const numberSize = Math.min(142 * scale, cardHeight * 0.48);
    const metricPhrase = metric.value + " " + metric.unit;
    const metricStart = metric.fact.toLowerCase().indexOf(metricPhrase.toLowerCase());
    const metricLabel = (metricStart >= 0 ? metric.fact.slice(0, metricStart) + metric.fact.slice(metricStart + metricPhrase.length) : metric.fact).replace(/^[\s,;:.-]+/, "").trim();
    content = rect(margin, cardY, width - margin * 2, cardHeight, primary, 26 * scale) +
      "<rect x=\"" + margin + "\" y=\"" + cardY + "\" width=\"" + (width - margin * 2) + "\" height=\"" + Math.max(5, 7 * scale) + "\" rx=\"" + (3 * scale) + "\" fill=\"" + accent + "\"/>" +
      textMarkup([metric.value], margin + 30 * scale, cardY + numberSize + 15 * scale, numberSize, numberSize, accent, font, 820, -2 * scale) +
      "<text x=\"" + (margin + 32 * scale) + "\" y=\"" + (cardY + numberSize + 48 * scale) + "\" fill=\"#F8F8F2\" font-family=\"" + escapeXml(font) + "\" font-size=\"" + Math.max(17, 27 * scale) + "\" font-weight=\"650\">" + escapeXml(metric.unit) + "</text>" +
      textMarkup(wrapWords(metricLabel || "Verified detail from the selected story", Math.max(20, Math.floor((width - margin * 2 - 64 * scale) / (Math.max(14, 18 * scale) * 0.55))), 2), margin + 32 * scale, cardY + cardHeight - 28 * scale, Math.max(16, 19 * scale), Math.max(14, 18 * scale), "#F8F8F2", font, 450, 0);
  } else if (layout === "decision") {
    const gap = 14 * scale;
    const half = (width - margin * 2 - gap) / 2;
    const cardHeight = contentHeight * 0.92;
    const leftY = contentY;
    const leftText = visibleFacts[0] || supporting;
    const rightText = visibleFacts[1] || input.story?.angle || supporting;
    const cardTitleSize = Math.max(12, 15 * scale);
    const bodySize = Math.max(15, 20 * scale);
    const leftLines = wrapWords(leftText, Math.max(15, Math.floor((half - 44 * scale) / (bodySize * 0.66))), 4);
    const rightLines = wrapWords(rightText, Math.max(15, Math.floor((half - 44 * scale) / (bodySize * 0.55))), 4);
    content = rect(margin, leftY, half, cardHeight, panel, 22 * scale, primary + "44") +
      rect(margin + half + gap, leftY, half, cardHeight, accent, 22 * scale) +
      "<text x=\"" + (margin + 22 * scale) + "\" y=\"" + (leftY + 32 * scale) + "\" fill=\"" + primary + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + cardTitleSize + "\" font-weight=\"700\" letter-spacing=\"1\">EVIDENCE</text>" +
      textMarkup(leftLines, margin + 22 * scale, leftY + 72 * scale, bodySize * 1.3, bodySize, ink, font, 620, -0.2) +
      "<text x=\"" + (margin + half + gap + 22 * scale) + "\" y=\"" + (leftY + 32 * scale) + "\" fill=\"" + primary + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + cardTitleSize + "\" font-weight=\"700\" letter-spacing=\"1\">CONTEXT</text>" +
      textMarkup(rightLines, margin + half + gap + 22 * scale, leftY + 72 * scale, bodySize * 1.3, bodySize, primary, font, 600, -0.2);
  } else if (layout === "lesson") {
    const cardHeight = contentHeight * 0.9;
    const cardY = contentY;
    const body = visibleFacts[0] || supporting;
    const maxChars = Math.max(18, Math.floor((width - margin * 2 - 60 * scale) / (Math.max(17, 24 * scale) * 0.66)));
    const lines = wrapWords(body, maxChars, Math.min(5, Math.max(2, Math.floor(cardHeight / (25 * scale)))));
    content = rect(margin, cardY, width - margin * 2, cardHeight, panel, 24 * scale, primary + "44") +
      rect(margin, cardY, 9 * scale, cardHeight, accent, 4 * scale) +
      "<text x=\"" + (margin + 32 * scale) + "\" y=\"" + (cardY + 38 * scale) + "\" fill=\"" + primary + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(12, 15 * scale) + "\" font-weight=\"700\" letter-spacing=\"1.4\">THE TAKEAWAY</text>" +
      textMarkup(lines, margin + 32 * scale, cardY + 92 * scale, Math.max(22, 31 * scale), Math.max(17, 25 * scale), ink, font, 650, -0.5);
  } else if (layout === "release" || layout === "steps") {
    const rowFacts = visibleFacts.length ? visibleFacts : [supporting];
    content = buildFactRows({ facts: rowFacts, x: margin, y: contentY, width: width - margin * 2, height: contentHeight * 0.98, font, ink, primary, accent, panel, scale });
  } else {
    const cardHeight = contentHeight * 0.88;
    const cardY = contentY + Math.max(0, contentHeight - cardHeight) * 0.04;
    const cardWidth = width - margin * 2;
    const fact = visibleFacts[0] || input.story?.angle || supporting;
    const secondary = visibleFacts[1] || input.story?.summary || supporting;
    const inner = 24 * scale;
    const leftWidth = cardWidth * (width > height ? 0.54 : 0.58);
    const rightX = margin + leftWidth + 12 * scale;
    const rightWidth = cardWidth - leftWidth - 12 * scale;
    const bodySize = Math.max(15, 22 * scale);
    const factLines = wrapWords(fact, Math.max(16, Math.floor((leftWidth - inner * 2) / (bodySize * 0.53))), width > height ? 4 : 5);
    const secondaryLines = wrapWords(secondary, Math.max(12, Math.floor((rightWidth - 24 * scale) / (Math.max(12, 16 * scale) * 0.52))), 4);
    const visualY = cardY + 22 * scale;
    const visualH = Math.max(76 * scale, cardHeight * 0.37);
    const visualW = Math.max(80 * scale, rightWidth - 18 * scale);
    const nodeR = Math.max(9 * scale, Math.min(18 * scale, visualW * 0.07));
    const centerX = rightX + rightWidth / 2;
    const centerY = visualY + visualH / 2;
    const motif = "<g stroke=\"" + primary + "\" stroke-width=\"" + Math.max(2, 3 * scale) + "\" stroke-linecap=\"round\" fill=\"none\" opacity=\".8\">" +
      "<path d=\"M" + (centerX - visualW * .28) + " " + (centerY - visualH * .18) + "L" + centerX + " " + centerY + "L" + (centerX + visualW * .28) + " " + (centerY - visualH * .18) + "\"/>" +
      "<path d=\"M" + centerX + " " + centerY + "L" + centerX + " " + (centerY + visualH * .28) + "\"/></g>" +
      "<circle cx=\"" + (centerX - visualW * .28) + "\" cy=\"" + (centerY - visualH * .18) + "\" r=\"" + nodeR + "\" fill=\"" + accent + "\"/>" +
      "<circle cx=\"" + (centerX + visualW * .28) + "\" cy=\"" + (centerY - visualH * .18) + "\" r=\"" + nodeR + "\" fill=\"" + accent + "\"/>" +
      "<circle cx=\"" + centerX + "\" cy=\"" + centerY + "\" r=\"" + (nodeR * 1.25) + "\" fill=\"" + primary + "\"/>" +
      "<circle cx=\"" + centerX + "\" cy=\"" + (centerY + visualH * .28) + "\" r=\"" + nodeR + "\" fill=\"" + panel + "\" stroke=\"" + primary + "\" stroke-width=\"" + Math.max(2, 3 * scale) + "\"/>";
    content = rect(margin, cardY, cardWidth, cardHeight, panel, 24 * scale, primary + "33") +
      rect(margin, cardY, 8 * scale, cardHeight, accent, 4 * scale) +
      "<text x=\"" + (margin + inner) + "\" y=\"" + (cardY + 32 * scale) + "\" fill=\"" + primary + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(11, 14 * scale) + "\" font-weight=\"700\" letter-spacing=\"1.2\">THE STORY, AT A GLANCE</text>" +
      rect(margin + inner, cardY + 48 * scale, leftWidth - inner * 2, Math.max(54 * scale, cardHeight * .43), background, 15 * scale, primary + "22") +
      textMarkup(factLines, margin + inner * 1.6, cardY + 48 * scale + 30 * scale, Math.max(20, 28 * scale), bodySize, ink, font, 650, -0.45) +
      rect(rightX, visualY, rightWidth, visualH + 12 * scale, background, 18 * scale, primary + "22") + motif +
      "<text x=\"" + (rightX + 10 * scale) + "\" y=\"" + (visualY + visualH + 30 * scale) + "\" fill=\"" + muted + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(9, 11 * scale) + "\" letter-spacing=\".7\">PRODUCT CONTEXT</text>" +
      textMarkup(secondaryLines, rightX + 2 * scale, visualY + visualH + 54 * scale, Math.max(14, 18 * scale), Math.max(12, 16 * scale), muted, font, 500, -0.1) +
      (visibleFacts.length > 1 ? "<text x=\"" + (margin + inner) + "\" y=\"" + (cardY + cardHeight - 18 * scale) + "\" fill=\"" + muted + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(9, 11 * scale) + "\" letter-spacing=\".8\">SOURCE-GROUNDED DETAIL · " + visibleFacts.length + " ITEMS</text>" : "");
  }
  const footer = "<path d=\"M" + margin + " " + (footerY - 25 * scale) + "H" + (width - margin) + "\" stroke=\"" + primary + "\" opacity=\".18\"/>" +
    "<text x=\"" + margin + "\" y=\"" + footerY + "\" fill=\"" + muted + "\" font-family=\"JetBrains Mono, monospace\" font-size=\"" + Math.max(10, 12 * scale) + "\" letter-spacing=\"1.1\">STORY / EVIDENCE / CONTEXT</text>" +
    "<rect x=\"" + (width - margin - accentWidth) + "\" y=\"" + (footerY - 8 * scale) + "\" width=\"" + accentWidth + "\" height=\"" + (5 * scale) + "\" rx=\"" + (2 * scale) + "\" fill=\"" + accent + "\">" + accentAnimation + "</rect>";
  const editorialAccent = kit.style === "bold"
    ? "<path d=\"M0 0H" + Math.round(width * 0.22) + "L0 " + Math.round(72 * scale) + "Z\" fill=\"" + accent + "\" opacity=\".5\"/>"
    : kit.style === "technical" ? bgGrid : "";
  return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\" viewBox=\"0 0 " + width + " " + height + "\" role=\"img\" aria-label=\"" + escapeXml(headline) + "\">" +
    "<defs><linearGradient id=\"rbf-background\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0%\" stop-color=\"" + background + "\"/><stop offset=\"100%\" stop-color=\"" + panel + "\"/></linearGradient></defs>" +
    "<rect width=\"100%\" height=\"100%\" fill=\"url(#rbf-background)\"/>" + editorialAccent + header + heading + supportingMarkup + content + footer + "</svg>";
}
