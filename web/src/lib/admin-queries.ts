import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OrderStatus } from "@/db/schema";

export async function ordersWithContext(statuses?: OrderStatus[], limit = 200) {
  const d = await db();
  return d
    .select({ o: schema.orders, title: schema.projects.title, member: schema.users.name, partner: schema.partners.name })
    .from(schema.orders)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.orders.projectId))
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .leftJoin(schema.partners, eq(schema.partners.id, schema.orders.partnerId))
    .where(statuses ? inArray(schema.orders.status, statuses) : undefined)
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit);
}
