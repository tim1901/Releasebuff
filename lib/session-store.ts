import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BufferSession } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data", "integration-state");
const STORE_NAME = "releasebuff-integration-state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface GitHubInstallationConnection {
  installationId: number;
  connectedAt: string;
}

export interface GitHubUserAuthorization {
  accessToken: string;
  authorizedAt: string;
}

export function isSessionEncryptionConfigured(): boolean {
  const configured = process.env.SESSION_ENCRYPTION_KEY;
  return Boolean(configured && configured !== "replace-with-a-long-random-secret" && configured.length >= 32);
}

function encryptionKey(): Buffer {
  const configured = process.env.SESSION_ENCRYPTION_KEY;
  if (!isSessionEncryptionConfigured() || !configured) {
    throw new Error("SESSION_ENCRYPTION_KEY is missing. Generate a long random key and add it to .env.local.");
  }
  return createHash("sha256").update(configured, "utf8").digest();
}
function encrypt(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
function decrypt(value: string): string {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Encrypted session payload is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString("utf8");
}
function validateSid(sid: string) {
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(sid)) throw new Error("Invalid session identifier.");
}
function isNetlifyBlobsRuntime(): boolean {
  // NETLIFY is documented as a build-time variable; SITE_ID and URL are
  // available to Netlify Functions at runtime. Detect both contexts so the
  // production route handlers select Blobs instead of the local-file fallback.
  return Boolean(process.env.SITE_ID && process.env.URL)
    || process.env.NETLIFY === "true"
    || process.env.NETLIFY_DEV === "true";
}
async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, consistency: "strong" });
}
function filePath(key: string) {
  const safeName = createHash("sha256").update(key).digest("hex");
  return path.join(DATA_DIR, `${safeName}.enc`);
}
async function writeEncryptedRecord(key: string, value: unknown, ttlSeconds = SESSION_TTL_SECONDS): Promise<void> {
  const record = encrypt(JSON.stringify({ value, expiresAt: Date.now() + ttlSeconds * 1000 }));
  if (isNetlifyBlobsRuntime()) {
    const store = await netlifyStore();
    await store.set(key, record, { metadata: { expiresAt: Date.now() + ttlSeconds * 1000, type: "encrypted-integration-state" } });
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Persistent integration storage requires Netlify Blobs. Deploy on Netlify or use Netlify Dev.");
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await writeFile(filePath(key), record, { mode: 0o600 });
}
async function readEncryptedRecord<T>(key: string): Promise<T | null> {
  let encrypted: string | null = null;
  if (isNetlifyBlobsRuntime()) {
    const store = await netlifyStore();
    encrypted = await store.get(key, { type: "text", consistency: "strong" });
  } else {
    if (process.env.NODE_ENV === "production") throw new Error("Persistent integration storage requires Netlify Blobs.");
    try { encrypted = await readFile(filePath(key), "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  if (!encrypted) return null;
  try {
    const decoded = JSON.parse(decrypt(encrypted)) as { value: T; expiresAt: number };
    if (typeof decoded.expiresAt !== "number" || decoded.expiresAt <= Date.now()) {
      await deleteEncryptedRecord(key).catch(() => undefined);
      return null;
    }
    return decoded.value ?? null;
  } catch {
    // Do not leak cryptographic detail to callers. A malformed record requires reconnection.
    return null;
  }
}
async function deleteEncryptedRecord(key: string): Promise<void> {
  if (isNetlifyBlobsRuntime()) {
    const store = await netlifyStore();
    await store.delete(key);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Persistent integration storage requires Netlify Blobs.");
  try { await unlink(filePath(key)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

export function createSessionId(): string { return randomBytes(32).toString("base64url"); }
export async function writeBufferSession(sid: string, session: BufferSession): Promise<void> {
  validateSid(sid);
  await writeEncryptedRecord(`buffer-session:${sid}`, session, SESSION_TTL_SECONDS);
}
export async function readBufferSession(sid: string): Promise<BufferSession | null> {
  validateSid(sid);
  const session = await readEncryptedRecord<BufferSession>(`buffer-session:${sid}`);
  if (!session || typeof session.accessToken !== "string" || typeof session.expiresAt !== "number") return null;
  return session;
}
export async function deleteBufferSession(sid: string): Promise<void> {
  validateSid(sid);
  await deleteEncryptedRecord(`buffer-session:${sid}`);
}

export async function writeGitHubInstallation(sid: string, connection: GitHubInstallationConnection): Promise<void> {
  validateSid(sid);
  if (!Number.isSafeInteger(connection.installationId) || connection.installationId < 1) throw new Error("Invalid GitHub installation identifier.");
  await writeEncryptedRecord(`github-installation:${sid}`, connection, SESSION_TTL_SECONDS);
}
export async function readGitHubInstallation(sid: string): Promise<GitHubInstallationConnection | null> {
  validateSid(sid);
  const connection = await readEncryptedRecord<GitHubInstallationConnection>(`github-installation:${sid}`);
  if (!connection || !Number.isSafeInteger(connection.installationId) || connection.installationId < 1) return null;
  return connection;
}
export async function deleteGitHubInstallation(sid: string): Promise<void> {
  validateSid(sid);
  await deleteEncryptedRecord(`github-installation:${sid}`);
}

// Temporary GitHub user token is retained only during the install hand-off so
// the setup callback can verify that the authenticated user can access the
// returned installation. The record expires after ten minutes.
export async function writeGitHubUserAuthorization(sid: string, authorization: GitHubUserAuthorization): Promise<void> {
  validateSid(sid);
  await writeEncryptedRecord(`github-user-authorization:${sid}`, authorization, 10 * 60);
}
export async function readGitHubUserAuthorization(sid: string): Promise<GitHubUserAuthorization | null> {
  validateSid(sid);
  const authorization = await readEncryptedRecord<GitHubUserAuthorization>(`github-user-authorization:${sid}`);
  return authorization && typeof authorization.accessToken === "string" && authorization.accessToken.length > 10 ? authorization : null;
}
export async function deleteGitHubUserAuthorization(sid: string): Promise<void> {
  validateSid(sid);
  await deleteEncryptedRecord(`github-user-authorization:${sid}`);
}

export function persistentIntegrationStoreConfigured(): boolean {
  if (isNetlifyBlobsRuntime()) return true;
  return process.env.NODE_ENV !== "production";
}

export function oauthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}
export const SESSION_COOKIE = "releasebuff_sid";
