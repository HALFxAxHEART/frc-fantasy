import { db, schema } from "@frc-fantasy/db";
import { eq } from "drizzle-orm";
import type { RegisterInput, LoginInput } from "@frc-fantasy/shared";
import { SESSION_TTL_MS } from "../../lib/cookies";
import { ValidationError } from "../../lib/errors";

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

function generateSessionToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}

interface AuthResult {
  user: { id: string; email: string; displayName: string; avatarUrl: string | null };
  rawToken: string;
  expiresAt: Date;
}

async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null },
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(schema.sessions).values({
    userId,
    tokenHash,
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return { rawToken, expiresAt };
}

export async function registerUser(
  input: RegisterInput,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<AuthResult> {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);
  if (existing) throw new ValidationError("An account with that email already exists.");

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(schema.users)
    .values({ email: input.email, passwordHash, displayName: input.displayName })
    .returning();
  if (!user) throw new Error("failed to create user");

  const { rawToken, expiresAt } = await createSession(user.id, meta);
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
    rawToken,
    expiresAt,
  };
}

export async function loginUser(
  input: LoginInput,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<AuthResult> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
  if (!user) throw new ValidationError("Invalid email or password.");

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new ValidationError("Invalid email or password.");

  const { rawToken, expiresAt } = await createSession(user.id, meta);
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
    rawToken,
    expiresAt,
  };
}

export async function logoutSession(rawToken: string): Promise<void> {
  const tokenHash = await hashToken(rawToken);
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
}

export async function getUserBySessionToken(rawToken: string) {
  const tokenHash = await hashToken(rawToken);
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  return { id: row.id, email: row.email, displayName: row.displayName, avatarUrl: row.avatarUrl };
}
