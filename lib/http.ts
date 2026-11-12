import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}
export function getAppBaseUrl(request: Request): URL {
  const configured = process.env.APP_BASE_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("APP_BASE_URL must be configured in production."), { status: 503, code: "app_base_url_missing" });
  }
  const url = configured ? new URL(configured) : new URL(new URL(request.url).origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw Object.assign(new Error("APP_BASE_URL must be a valid HTTP(S) origin."), { status: 500, code: "invalid_app_base_url" });
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw Object.assign(new Error("APP_BASE_URL must use HTTPS in production."), { status: 500, code: "app_base_url_requires_https" });
  }
  return new URL(url.origin);
}

export function assertSameOrigin(request: Request) {
  // Validate against the origin serving this request. APP_BASE_URL is a canonical URL for
  // callbacks and may point at production while a Netlify Deploy Preview uses its own host.
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const suppliedOrigin = origin || (referer ? new URL(referer).origin : "");
  if (!suppliedOrigin || suppliedOrigin !== requestOrigin) {
    throw Object.assign(new Error("Cross-origin request blocked. Reload the app and try again."), { status: 403, code: "origin_mismatch" });
  }
}
export function errorStatus(error: unknown, fallback = 500) {
  if (typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number") return (error as { status: number }).status;
  return fallback;
}
export function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
  return undefined;
}
export function safeErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  return error instanceof Error ? error.message : fallback;
}
