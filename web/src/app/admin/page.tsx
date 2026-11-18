import { count, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { AdminOrdersTable } from "@/components/app/AdminOrdersTable";
import { Empty, PageHead, Stat } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { ordersWithContext } from "@/lib/admin-queries";
import { fmtDate } from "@/lib/format";
import { appT } from "@/lib/lang-server";

export default async function AdminHome() {
  const { a, lang } = await appT();
  const d = await db();
  const [[m], [p], [open], [toQuote], requests, recent] = await Promise.all([
    d.select({ n: count() }).from(schema.users),
    d.select({ n: count() }).from(schema.projects),
    d.select({ n: count() }).from(schema.orders).where(inArray(schema.orders.status, ["quote_requested", "quoted", "approved", "fabrication", "assembly", "testing", "shipped"])),
    d.select({ n: count() }).from(schema.orders).where(eq(schema.orders.status, "quote_requested")),
    d
      .select({ id: schema.projects.id, title: schema.projects.title, brief: schema.projects.brief, createdAt: schema.projects.createdAt, member: schema.users.name })
      .from(schema.projects)
      .innerJoin(schema.users, eq(schema.users.id, schema.projects.userId))
      .where(eq(schema.projects.status, "design_requested")),
    ordersWithContext(undefined, 8),
  ]);
  return (
    <>
      <PageHead title={a.admin.title} lede={a.admin.lede} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={a.admin.stats.members} value={m.n} />
        <Stat label={a.admin.stats.projects} value={p.n} />
        <Stat label={a.admin.stats.openOrders} value={open.n} />
        <Stat label={a.admin.stats.toQuote} value={<span className={toQuote.n ? "text-warn" : ""}>{toQuote.n}</span>} />
        <Stat label={a.admin.stats.toDesign} value={<span className={requests.length ? "text-warn" : ""}>{requests.length}</span>} />
      </div>

      <h2 className="eyebrow mb-3 mt-10">{a.admin.designQueue}</h2>
      {requests.length === 0 ? (
        <Empty>{a.admin.none}</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {requests.map((r) => (
            <Link key={r.id} href="/admin/projeler" className="card block p-4 hover:border-line-3">
              <div className="flex justify-between gap-3">
                <span className="font-display text-[17px] font-semibold">{r.title}</span>
                <span className="fig">{fmtDate(r.createdAt, lang)}</span>
              </div>
              <div className="fig mt-1">{r.member}</div>
              <p className="mt-2 line-clamp-2 text-[13px] text-t-2">{r.brief}</p>
            </Link>
          ))}
        </div>
      )}

      <h2 className="eyebrow mb-3 mt-10">{a.admin.recentOrders}</h2>
      {recent.length === 0 ? <Empty>{a.admin.none}</Empty> : <AdminOrdersTable rows={recent} a={a} lang={lang} />}
    </>
  );
}
