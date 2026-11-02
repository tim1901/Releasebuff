import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listInstallationRepositories } from "@/lib/github-app";
import { readGitHubInstallation, SESSION_COOKIE } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const store = await cookies(); const sid = store.get(SESSION_COOKIE)?.value;
  if (!sid) return NextResponse.json({ error: "Connect GitHub before listing repositories." }, { status: 401 });
  try {
    const connection = await readGitHubInstallation(sid);
    if (!connection) return NextResponse.json({ error: "No GitHub App installation is connected." }, { status: 401 });
    const repositories = await listInstallationRepositories(connection.installationId);
    return NextResponse.json({ repositories: repositories.map(repo => ({ id: repo.id, name: repo.name, fullName: repo.full_name, private: repo.private, url: repo.html_url, description: repo.description, defaultBranch: repo.default_branch, language: repo.language, updatedAt: repo.updated_at })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof (error as {status?: unknown}).status === "number" ? (error as {status:number}).status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not list repositories." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
