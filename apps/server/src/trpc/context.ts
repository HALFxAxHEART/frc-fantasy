import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getUserBySessionToken } from "../services/auth";
import { parseCookies, SESSION_COOKIE_NAME } from "../lib/cookies";

export async function createContext({ req, resHeaders }: FetchCreateContextFnOptions) {
  const cookies = parseCookies(req.headers.get("cookie"));
  const rawToken = cookies[SESSION_COOKIE_NAME] ?? null;
  const user = rawToken ? await getUserBySessionToken(rawToken) : null;

  return {
    user,
    rawToken,
    resHeaders,
    ip: req.headers.get("x-forwarded-for") ?? null,
    userAgent: req.headers.get("user-agent"),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
