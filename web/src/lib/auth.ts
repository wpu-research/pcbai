import "server-only";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";

const COOKIE = "pcbai_session";
const DAYS = 30;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const normEmail = (e: string) => e.trim().toLowerCase();


export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DAYS * 864e5);
  const d = await db();
  await d.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const d = await db();
    await d.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  jar.delete(COOKIE);
}

/** The signed-in user for this request, or null. */
export const currentUser = cache(async (): Promise<Omit<User, "passwordHash"> | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const d = await db();
  const rows = await d
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows.length) return null;
  const { passwordHash: _omit, ...user } = rows[0].user;
  void _omit;
  return user;
});

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/giris");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/panel");
  return u;
}

/* very small in-memory limiter: 8 attempts / 10 min per key */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max = 8, windowMs = 10 * 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
