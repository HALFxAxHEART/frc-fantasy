import { env } from "../config/env";

export const SESSION_COOKIE_NAME = "session_token";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function serializeSessionCookie(token: string, expiresAt: Date): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (env.NODE_ENV === "production") attrs.push("Secure");
  if (env.COOKIE_DOMAIN) attrs.push(`Domain=${env.COOKIE_DOMAIN}`);
  return attrs.join("; ");
}

export function serializeClearedSessionCookie(): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (env.NODE_ENV === "production") attrs.push("Secure");
  if (env.COOKIE_DOMAIN) attrs.push(`Domain=${env.COOKIE_DOMAIN}`);
  return attrs.join("; ");
}
