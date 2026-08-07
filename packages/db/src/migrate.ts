import { migrate } from "drizzle-orm/bun-sql/migrator";
import { db } from "./client";

await migrate(db, { migrationsFolder: "./migrations" });
console.log("Migrations applied.");
process.exit(0);
