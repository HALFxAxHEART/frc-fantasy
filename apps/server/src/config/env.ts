import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  TBA_API_KEY: z.string().min(1),
  STATBOTICS_API_BASE: z.string().url().default("https://api.statbotics.io/v3"),
  SESSION_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  COOKIE_DOMAIN: z.string().optional(),
  JOBS_MODE: z.enum(["coolify", "in-process"]).default("coolify"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/** Fails fast at boot rather than misbehaving later on missing/malformed config. */
export const env = envSchema.parse(process.env);
export type Env = typeof env;
