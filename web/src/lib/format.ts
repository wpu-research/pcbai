import type { Lang } from "./dict";
import type { OrderStatus } from "@/db/schema";

export const fmtDate = (d: Date | string | null | undefined, lang: Lang, time = false) =>
  d
    ? new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(d))
    : "—";

export const fmtMoney = (cents: number | null | undefined, currency: string, lang: Lang) =>
  cents == null ? "—" : new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency }).format(cents / 100);

export const orderNo = (n: number | null) => (n ? `#${n}` : "#—");

/** Visual tone for each order status. */
export const ORDER_TONE: Record<OrderStatus, "muted" | "teal" | "pink" | "ok" | "warn" | "crit"> = {
  quote_requested: "warn",
  quoted: "pink",
  approved: "teal",
  fabrication: "teal",
  assembly: "teal",
  testing: "teal",
  shipped: "teal",
  delivered: "ok",
  cancelled: "crit",
};

/** The member-facing progress steps (cancelled is shown separately). */
export const ORDER_STEPS: OrderStatus[] = ["quote_requested", "quoted", "approved", "fabrication", "assembly", "testing", "shipped", "delivered"];
