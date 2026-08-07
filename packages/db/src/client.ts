import { drizzle } from "drizzle-orm/bun-sql";
import { SQL } from "bun";
import * as schema from "./schema";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const client = new SQL(requireEnv("DATABASE_URL"));

export const db = drizzle({ client, schema });
export type Database = typeof db;
