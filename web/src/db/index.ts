import "server-only";
import path from "node:path";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema";

/**
 * Railway Postgres in production (DATABASE_URL from the Postgres service).
 * Locally, `npm run db:local` serves an embedded PGlite database over the Postgres wire protocol.
 * Migrations in ./drizzle run once per process, before the first query.
 */
async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (locally: run `npm run db:local` and see .env.local)");
  const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 5) });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seedAdmin(db);
  return db;
}

/**
 * The first admin comes from ADMIN_EMAIL + ADMIN_PASSWORD (server secrets), never from sign-up:
 * there is no email verification, so granting admin by address at registration would let anyone claim it.
 * Runs only when that account does not exist yet; further admins are promoted from the admin panel.
 */
async function seedAdmin(db: ReturnType<typeof drizzle<typeof schema>>) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) return;
  const found = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (found.length) return;
  await db.insert(schema.users).values({ email, name: process.env.ADMIN_NAME ?? "Admin", role: "admin", passwordHash: await bcrypt.hash(password, 11) });
}

const g = globalThis as { __pcbaiDb?: ReturnType<typeof connect> };

export function db() {
  // a failed connection is not cached, so the next request retries
  g.__pcbaiDb ??= connect().catch((e) => {
    g.__pcbaiDb = undefined;
    throw e;
  });
  return g.__pcbaiDb;
}

export { schema };
