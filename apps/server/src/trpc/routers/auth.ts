import { loginSchema, registerSchema } from "@frc-fantasy/shared";
import { loginUser, logoutSession, registerUser } from "../../services/auth";
import { serializeClearedSessionCookie, serializeSessionCookie } from "../../lib/cookies";
import { publicProcedure, protectedProcedure, router } from "../trpc";

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    const result = await registerUser(input, { userAgent: ctx.userAgent, ip: ctx.ip });
    ctx.resHeaders.append("set-cookie", serializeSessionCookie(result.rawToken, result.expiresAt));
    return { user: result.user };
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const result = await loginUser(input, { userAgent: ctx.userAgent, ip: ctx.ip });
    ctx.resHeaders.append("set-cookie", serializeSessionCookie(result.rawToken, result.expiresAt));
    return { user: result.user };
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.rawToken) await logoutSession(ctx.rawToken);
    ctx.resHeaders.append("set-cookie", serializeClearedSessionCookie());
    return { success: true };
  }),

  me: protectedProcedure.query(({ ctx }) => ({ user: ctx.user })),
});
