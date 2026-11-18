"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { checkPassword, createSession, destroySession, hashPassword, normEmail, rateLimited } from "@/lib/auth";

export type AuthState = { error?: string; email?: string; name?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function clientKey(email: string) {
  const h = await headers();
  return `${h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}|${email}`;
}

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = normEmail(String(form.get("email") ?? "")).slice(0, 160);
  const password = String(form.get("password") ?? "");
  if (!name) return { error: "name", email, name };
  if (!EMAIL.test(email)) return { error: "email", email, name };
  if (password.length < 8 || password.length > 200) return { error: "weak", email, name };
  if (rateLimited(await clientKey("register"), 10)) return { error: "limited", email, name };
  const d = await db();
  const exists = await d.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (exists.length) return { error: "exists", email, name };
  const [u] = await d
    .insert(schema.users)
    .values({ name, email, passwordHash: await hashPassword(password), role: "member", lastLoginAt: new Date() })
    .returning({ id: schema.users.id, role: schema.users.role });
  await createSession(u.id);
  redirect(u.role === "admin" ? "/admin" : "/panel");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = normEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (rateLimited(await clientKey(email))) return { error: "limited", email };
  const d = await db();
  const [u] = await d.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!u || !(await checkPassword(password, u.passwordHash))) return { error: "invalid", email };
  const role = u.role;
  await d.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, u.id));
  await createSession(u.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : role === "admin" ? "/admin" : "/panel");
}

export async function logout() {
  await destroySession();
  redirect("/giris");
}

export type PwState = { ok?: boolean; error?: string };

/** Change password: checks the current one, then signs out every other session. */
export async function changePassword(_: PwState, form: FormData): Promise<PwState> {
  const { requireUser, createSession } = await import("@/lib/auth");
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8 || next.length > 200) return { error: "weak" };
  if (rateLimited(`pw|${me.id}`, 6)) return { error: "limited" };
  const d = await db();
  const [u] = await d.select().from(schema.users).where(eq(schema.users.id, me.id)).limit(1);
  if (!u || !(await checkPassword(current, u.passwordHash))) return { error: "invalid" };
  await d.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, me.id));
  await d.delete(schema.sessions).where(eq(schema.sessions.userId, me.id));
  await createSession(me.id);
  return { ok: true };
}
