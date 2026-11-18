"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { ORDER_STATUS, PARTNER_STATUS, type OrderStatus, type PartnerStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { fromTemplate, TEMPLATES } from "@/lib/pcb/templates";

const UUID = /^[0-9a-f-]{36}$/;
const s = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

export async function updateOrder(orderId: string, form: FormData) {
  await requireAdmin();
  if (!UUID.test(orderId)) return;
  const d = await db();
  const [o] = await d.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!o) return;
  const status = ORDER_STATUS.includes(s(form, "status") as OrderStatus) ? (s(form, "status") as OrderStatus) : o.status;
  const quoteRaw = s(form, "quote").replace(",", ".");
  const quoteCents = quoteRaw ? Math.round(Number(quoteRaw) * 100) : null;
  const partnerId = UUID.test(s(form, "partnerId")) ? s(form, "partnerId") : null;
  // a quote entered on a fresh request moves it to "quoted"
  const next: OrderStatus = status === "quote_requested" && quoteCents && quoteCents > 0 ? "quoted" : status;
  await d
    .update(schema.orders)
    .set({
      status: next,
      quoteCents: quoteCents !== null && Number.isFinite(quoteCents) && quoteCents >= 0 ? quoteCents : o.quoteCents,
      partnerId,
      tracking: s(form, "tracking", 120),
      adminNote: s(form, "adminNote", 4000),
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, orderId));
  const note = s(form, "eventNote", 1000);
  if (next !== o.status || note) await d.insert(schema.orderEvents).values({ orderId, status: next, note, byAdmin: 1 });
  revalidatePath(`/admin/siparisler/${orderId}`);
  revalidatePath("/admin/siparisler");
  revalidatePath(`/panel/p/${o.projectId}`);
}

export async function savePartner(form: FormData) {
  await requireAdmin();
  const id = s(form, "id");
  const values = {
    name: s(form, "name", 120),
    city: s(form, "city", 80),
    contactName: s(form, "contactName", 120),
    email: s(form, "email", 160),
    phone: s(form, "phone", 60),
    website: s(form, "website", 200),
    services: s(form, "services", 400),
    leadTime: s(form, "leadTime", 120),
    status: (PARTNER_STATUS.includes(s(form, "status") as PartnerStatus) ? s(form, "status") : "talking") as PartnerStatus,
    notes: s(form, "notes", 6000),
  };
  if (!values.name) return;
  const d = await db();
  if (UUID.test(id)) await d.update(schema.partners).set(values).where(eq(schema.partners.id, id));
  else await d.insert(schema.partners).values(values);
  revalidatePath("/admin/firmalar");
}

export async function deletePartner(id: string) {
  await requireAdmin();
  if (!UUID.test(id)) return;
  const d = await db();
  await d.delete(schema.partners).where(eq(schema.partners.id, id));
  revalidatePath("/admin/firmalar");
}

export async function setRole(userId: string, role: "admin" | "member") {
  const me = await requireAdmin();
  if (!UUID.test(userId) || userId === me.id) return; // never demote yourself
  const d = await db();
  await d.update(schema.users).set({ role }).where(eq(schema.users.id, userId));
  revalidatePath("/admin/uyeler");
}

/** Answer a design request by attaching a starting design the member can review and edit. */
export async function attachDesign(projectId: string, form: FormData) {
  await requireAdmin();
  if (!UUID.test(projectId)) return;
  const key = s(form, "template");
  const d = await db();
  const [p] = await d.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!p || !TEMPLATES[key]) return;
  await d
    .update(schema.projects)
    .set({ spec: fromTemplate(key, `p-${p.id}`, p.title), status: "draft", version: p.version + 1, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
  revalidatePath("/admin");
  revalidatePath("/admin/projeler");
  revalidatePath(`/panel/p/${projectId}`);
}
