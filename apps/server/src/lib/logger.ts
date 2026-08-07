import { env } from "../config/env";

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

function shouldLog(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(env.LOG_LEVEL);
}

function log(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const line = { time: new Date().toISOString(), level, scope, message, ...meta };
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  out(JSON.stringify(line));
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => log("debug", scope, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log("info", scope, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", scope, message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", scope, message, meta),
  };
}
