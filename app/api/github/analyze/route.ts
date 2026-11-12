import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { analyzePublicRepository, parseGitHubRepositoryUrl } from "@/lib/github";
import { hasAiConfiguration } from "@/lib/ai";
import { assertSameOrigin, errorStatus, jsonError, safeErrorMessage } from "@/lib/http";
import { allowRequest } from "@/lib/rate-limit";
import { getInstallationTokenForRepository } from "@/lib/github-app";
import { readGitHubInstallation, SESSION_COOKIE } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return jsonError(safeErrorMessage(error), 403, "forbidden_origin"); }
  if (Number(request.headers.get("content-length") ?? 0) > 5_500_000) return jsonError("The request is too large. Reduce the number of source materials or upload a smaller image/PDF.", 413, "payload_too_large");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(`github:${ip}`, 12, 60_000)) return jsonError("Too many scan requests. Wait a minute and try again.", 429, "rate_limited");
  try {
    const body = await request.json() as {
      repositoryUrl?: unknown; force?: unknown; useGitHubApp?: unknown;
    };
    if (typeof body.repositoryUrl !== "string" || body.repositoryUrl.length > 500) return jsonError("Enter a GitHub repository URL.");
    let token: string | undefined;
    if (body.useGitHubApp === true) {
      const cookiesStore = await cookies();
      const sid = cookiesStore.get(SESSION_COOKIE)?.value;
      if (!sid) return jsonError("Connect GitHub before scanning private repositories.", 401, "github_not_connected");
      const installation = await readGitHubInstallation(sid);
      if (!installation) return jsonError("Connect GitHub and choose which repositories Releasebuff can access.", 401, "github_not_connected");
      const parsed = parseGitHubRepositoryUrl(body.repositoryUrl);
      token = await getInstallationTokenForRepository(installation.installationId, parsed.owner, parsed.repo);
    }
    const analysis = await analyzePublicRepository(body.repositoryUrl, { force: body.force === true, token });
    return NextResponse.json({
      ...analysis,
      aiConfigured: hasAiConfiguration(),
      accessMode: token ? "github-app" : "public"
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(safeErrorMessage(error, "Could not analyze this repository."), errorStatus(error, 422), "github_analysis_failed");
  }
}
