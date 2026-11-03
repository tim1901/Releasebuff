import { NextResponse } from "next/server";
import { configuredAiModel, hasAiConfiguration } from "@/lib/ai";
import { isBufferOAuthConfigured } from "@/lib/buffer-api";
import { isGitHubAppConfigured } from "@/lib/github-app";
import { isSessionEncryptionConfigured, persistentIntegrationStoreConfigured } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true, app: "Releasebuff", version: "0.2.0",
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    capabilities: {
      publicGitHubAnalysis: true, privateGitHubApp: isGitHubAppConfigured(),
      aiDrafts: hasAiConfiguration(), aiModel: hasAiConfiguration() ? configuredAiModel() : null,
      bufferOAuth: isBufferOAuthConfigured(),
      encryptedIntegrationStore: isSessionEncryptionConfigured() && persistentIntegrationStoreConfigured(),
      productMaterials: true, adaptiveStoryInterview: true
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
