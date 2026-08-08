import { env } from "../config/env";

function adminEmailSet(): Set<string> {
  return new Set(
    env.ADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string): boolean {
  return adminEmailSet().has(email.trim().toLowerCase());
}
