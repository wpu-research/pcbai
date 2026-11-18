"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { runDrc } from "@/lib/pcb/drc";
import { applyEdits, fromTemplate, TEMPLATES } from "@/lib/pcb/templates";
import type { BoardSpec, Footprint } from "@/lib/pcb/types";

/** One-line, printable title (it ends up in Gerber comments and drawings). */
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f*%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

async function footprints(spec: BoardSpec) {
  const map = new Map<string, Footprint>();
  for (const k of new Set(spec.parts.map((p) => p.footprint))) {
    map.set(k, JSON.parse(await readFile(path.join(process.cwd(), "public/library/footprints", `${k}.json`), "utf8")));
  }
  return map;
}

/** The project if the signed-in user owns it (admins may open any). */
export async function ownedProject(id: string) {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const d = await db();
  const [p] = await d
    .select()
    .from(schema.projects)
    .where(user.role === "admin" ? eq(schema.projects.id, id) : and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
    .limit(1);
  return p ? { project: p, user } : null;
}

export async function createProject(form: FormData) {
  const user = await requireUser();
  const title = clean(String(form.get("title") ?? "")) || "Untitled board";
  const brief = String(form.get("brief") ?? "").trim().slice(0, 4000);
  const start = String(form.get("start") ?? "template");
  const template = String(form.get("template") ?? "field-node");
  const d = await db();
  const [p] = await d
    .insert(schema.projects)
    .values({ userId: user.id, title, brief, source: start === "brief" ? "brief" : "template", status: start === "brief" ? "design_requested" : "draft" })
    .returning({ id: schema.projects.id });
  if (start !== "brief") {
    const spec = fromTemplate(TEMPLATES[template] ? template : "field-node", `p-${p.id}`, title);
    await d.update(schema.projects).set({ spec }).where(eq(schema.projects.id, p.id));
  }
  revalidatePath("/panel");
  redirect(`/panel/p/${p.id}`);
}

export async function saveBoard(id: string, edits: unknown): Promise<{ ok: boolean; version?: number; issues?: number }> {
  const owned = await ownedProject(id);
  if (!owned?.project.spec) return { ok: false };
  const spec = applyEdits(owned.project.spec, edits);
  const issues = runDrc(spec, await footprints(spec)).length;
  const d = await db();
  const version = owned.project.version + 1;
  await d
    .update(schema.projects)
    .set({ spec, version, updatedAt: new Date(), status: owned.project.status === "ordered" ? "ordered" : issues ? "draft" : "ready" })
    .where(eq(schema.projects.id, id));
  revalidatePath(`/panel/p/${id}`);
  return { ok: true, version, issues };
}

export async function renameProject(id: string, form: FormData) {
  const owned = await ownedProject(id);
  if (!owned) return;
  const title = clean(String(form.get("title") ?? ""));
  if (!title) return;
  const d = await db();
  await d.update(schema.projects).set({ title, updatedAt: new Date() }).where(eq(schema.projects.id, id));
  revalidatePath(`/panel/p/${id}`);
}

export async function deleteProject(id: string) {
  const owned = await ownedProject(id);
  if (!owned) return;
  const d = await db();
  await d.delete(schema.projects).where(eq(schema.projects.id, id));
  revalidatePath("/panel");
  redirect("/panel");
}

/* ---------- orders (member side) ---------- */

export async function requestQuote(id: string, form: FormData) {
  const owned = await ownedProject(id);
  if (!owned?.project.spec) return;
  const spec = owned.project.spec;
  if (runDrc(spec, await footprints(spec)).length) return;
  const quantity = Math.min(1000, Math.max(1, Math.round(Number(form.get("quantity")) || 5)));
  const note = String(form.get("note") ?? "").trim().slice(0, 2000);
  const d = await db();
  const [o] = await d
    .insert(schema.orders)
    .values({ projectId: id, userId: owned.project.userId, quantity, note, spec, specVersion: owned.project.version })
    .returning({ id: schema.orders.id });
  await d.insert(schema.orderEvents).values({ orderId: o.id, status: "quote_requested", note });
  await d.update(schema.projects).set({ status: "ordered", updatedAt: new Date() }).where(eq(schema.projects.id, id));
  revalidatePath(`/panel/p/${id}`);
  revalidatePath("/panel/siparisler");
}

async function memberOrder(orderId: string) {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return null;
  const d = await db();
  const [o] = await d
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.userId, user.id)))
    .limit(1);
  return o ?? null;
}

export async function approveQuote(orderId: string) {
  const o = await memberOrder(orderId);
  if (!o || o.status !== "quoted") return;
  const d = await db();
  await d.update(schema.orders).set({ status: "approved", updatedAt: new Date() }).where(eq(schema.orders.id, o.id));
  await d.insert(schema.orderEvents).values({ orderId: o.id, status: "approved" });
  revalidatePath(`/panel/p/${o.projectId}`);
  revalidatePath("/panel/siparisler");
}

export async function cancelOrder(orderId: string) {
  const o = await memberOrder(orderId);
  if (!o || !["quote_requested", "quoted"].includes(o.status)) return;
  const d = await db();
  await d.update(schema.orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.orders.id, o.id));
  await d.insert(schema.orderEvents).values({ orderId: o.id, status: "cancelled" });
  revalidatePath(`/panel/p/${o.projectId}`);
  revalidatePath("/panel/siparisler");
}

/* ---------- import from the MacademiaX virtual lab ---------- */

export async function createFromLab(payload: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const { parseLabExport, labToBoard, IMPORT_FOOTPRINTS } = await import("@/lib/lab/import");
  const { footprintsByKey } = await import("@/lib/pcb/server");
  const { serverLang } = await import("@/lib/lang-server");
  if (payload.length > 400_000) return { error: "too-large" };
  let lab;
  try {
    lab = parseLabExport(JSON.parse(payload));
  } catch {
    lab = null;
  }
  if (!lab) return { error: "invalid" };
  const lang = await serverLang();
  const title = clean(lab.name || (lang === "tr" ? "Laboratuvar devresi" : "Lab circuit"));
  const fps = await footprintsByKey(IMPORT_FOOTPRINTS(lab));
  const d = await db();
  const [p] = await d
    .insert(schema.projects)
    .values({ userId: user.id, title, brief: lang === "tr" ? "MacademiaX sanal laboratuvarından aktarıldı." : "Imported from the MacademiaX virtual lab.", source: "lab", status: "draft" })
    .returning({ id: schema.projects.id });
  const r = labToBoard(lab, { id: `p-${p.id}`, title, lang }, (k) => fps.get(k)!.bbox);
  const issues = runDrc(r.spec, fps).length;
  await d
    .update(schema.projects)
    .set({ spec: r.spec, sketch: r.sketch, status: issues ? "draft" : "ready" })
    .where(eq(schema.projects.id, p.id));
  revalidatePath("/panel");
  redirect(`/panel/p/${p.id}`);
}
