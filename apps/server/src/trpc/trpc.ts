import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { ForbiddenError, NotFoundError, NotImplementedError, ValidationError } from "../lib/errors";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const middleware = t.middleware;

/**
 * Services stay framework-agnostic (see NotFoundError/ValidationError/NotImplementedError
 * in lib/errors.ts) so a future Discord bot or cron job can call them without a tRPC
 * dependency. This middleware is the one place that translates those into proper
 * tRPC error codes, instead of every procedure catching them individually.
 */
const errorMappingMiddleware = t.middleware(async ({ next }) => {
  // tRPC's own middleware chain never rejects `next()`'s promise — a downstream
  // throw is caught internally and comes back as `{ ok: false, error }`, with the
  // original error preserved as `error.cause`. So mapping happens by inspecting the
  // result, not with try/catch (a plain try/catch here would never fire).
  const result = await next();
  if (!result.ok) {
    const cause = result.error.cause;
    if (cause instanceof NotFoundError) throw new TRPCError({ code: "NOT_FOUND", message: cause.message, cause });
    if (cause instanceof ValidationError) throw new TRPCError({ code: "BAD_REQUEST", message: cause.message, cause });
    if (cause instanceof ForbiddenError) throw new TRPCError({ code: "FORBIDDEN", message: cause.message, cause });
    if (cause instanceof NotImplementedError)
      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: cause.message, cause });
  }
  return result;
});

export const publicProcedure = t.procedure.use(errorMappingMiddleware);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
