import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { assertSameOrigin, safeErrorMessage } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 1_000_000;
function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a,b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) return true;
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateV4(mapped[1]) : false;
  }
  return true;
}
function cleanHtml(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/article|\/section|\/main|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return NextResponse.json({ error: safeErrorMessage(error) }, { status: 403 }); }
  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || body.url.length > 2000) return NextResponse.json({ error: "Enter a valid public URL." }, { status: 400 });
    const url = new URL(body.url);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return NextResponse.json({ error: "Only public HTTPS URLs on the default port can be fetched." }, { status: 400 });
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || isIP(host)) return NextResponse.json({ error: "This URL host is not allowed. Provide a public website or documentation URL." }, { status: 400 });
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) return NextResponse.json({ error: "This URL does not resolve exclusively to public IP addresses." }, { status: 400 });
    const response = await fetch(url, { redirect: "manual", cache: "no-store", headers: { Accept: "text/html,text/plain,text/markdown,application/json,application/xml,text/xml;q=0.9,*/*;q=0.1", "User-Agent": "Releasebuff/0.2 (+public-source-fetch)" }, signal: AbortSignal.timeout(12_000) });
    if (response.status >= 300 && response.status < 400) return NextResponse.json({ error: "This URL redirects. Add the final public URL instead." }, { status: 422 });
    if (!response.ok) return NextResponse.json({ error: `The source returned HTTP ${response.status}. Check whether the page is publicly accessible.` }, { status: 422 });
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!/(text\/html|text\/plain|text\/markdown|application\/json|application\/xml|text\/xml)/.test(contentType)) return NextResponse.json({ error: `This source type (${contentType || "unknown"}) is not supported by the text extractor. Upload or paste the relevant text instead.` }, { status: 415 });
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES) return NextResponse.json({ error: "This source is larger than the 1 MB extraction limit." }, { status: 413 });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) return NextResponse.json({ error: "This source is larger than the 1 MB extraction limit." }, { status: 413 });
    const raw = buffer.toString("utf8");
    const text = contentType.includes("text/html") ? cleanHtml(raw) : raw.slice(0, 80_000).trim();
    if (text.length < 30) return NextResponse.json({ error: "We could not extract enough readable text from this URL." }, { status: 422 });
    return NextResponse.json({ url: url.toString(), contentType, text: text.slice(0, 30_000), collectedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error, "Could not fetch this source.") }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
