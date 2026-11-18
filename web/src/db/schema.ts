import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { BoardSpec } from "@/lib/pcb/types";

export const ROLES = ["member", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha-256 of the cookie token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const PROJECT_STATUS = ["design_requested", "draft", "ready", "ordered"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    brief: text("brief").notNull().default(""),
    source: text("source").$type<"template" | "brief" | "lab">().notNull().default("template"),
    status: text("status").$type<ProjectStatus>().notNull().default("draft"),
    spec: jsonb("spec").$type<BoardSpec | null>(),
    sketch: text("sketch").notNull().default(""), // Arduino code brought from the virtual lab (with the pin map on top)
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const ORDER_STATUS = ["quote_requested", "quoted", "approved", "fabrication", "assembly", "testing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const PARTNER_STATUS = ["talking", "active", "paused"] as const;
export type PartnerStatus = (typeof PARTNER_STATUS)[number];

export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  website: text("website").notNull().default(""),
  services: text("services").notNull().default(""), // e.g. "PCB, SMD dizgi, THT"
  leadTime: text("lead_time").notNull().default(""),
  status: text("status").$type<PartnerStatus>().notNull().default("talking"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").generatedAlwaysAsIdentity({ startWith: 1001 }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    note: text("note").notNull().default(""),
    status: text("status").$type<OrderStatus>().notNull().default("quote_requested"),
    quoteCents: integer("quote_cents"),
    currency: text("currency").notNull().default("TRY"),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    tracking: text("tracking").notNull().default(""),
    adminNote: text("admin_note").notNull().default(""),
    spec: jsonb("spec").$type<BoardSpec>().notNull(), // frozen copy of the design that was ordered
    specVersion: integer("spec_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_project_idx").on(t.projectId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").$type<OrderStatus>().notNull(),
    note: text("note").notNull().default(""),
    byAdmin: integer("by_admin").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
