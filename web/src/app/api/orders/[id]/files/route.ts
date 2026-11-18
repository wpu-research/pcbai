import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/auth";
import { zipResponse } from "@/lib/files";

/** The exact revision that was ordered: for the member who ordered it and for admins. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const id = (await params).id;
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const d = await db();
  const [o] = await d.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!o || (o.userId !== user.id && user.role !== "admin")) return new Response("Not found", { status: 404 });
  return zipResponse(o.spec, `order-${o.number}`, o.specVersion);
}
