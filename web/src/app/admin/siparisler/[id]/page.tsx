import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrder } from "@/app/actions/admin";
import { BoardThumb } from "@/components/app/BoardThumb";
import { OrderTimeline } from "@/components/app/OrderTimeline";
import { PageHead, Pill } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { ORDER_STATUS } from "@/db/schema";
import { fmtDate, fmtMoney, ORDER_TONE, orderNo } from "@/lib/format";
import { appT } from "@/lib/lang-server";
import { routingCrossings } from "@/lib/pcb/drc";
import { routeBoard } from "@/lib/pcb/geometry";
import { serverFootprints } from "@/lib/pcb/server";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { a, lang } = await appT();
  const d = await db();
  const [row] = await d
    .select({ o: schema.orders, title: schema.projects.title, member: schema.users.name, email: schema.users.email })
    .from(schema.orders)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.orders.projectId))
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .where(eq(schema.orders.id, id))
    .limit(1);
  if (!row) notFound();
  const { o } = row;
  const [events, partners, fps] = await Promise.all([
    d.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id)).orderBy(asc(schema.orderEvents.createdAt)),
    d.select().from(schema.partners).orderBy(asc(schema.partners.name)),
    serverFootprints(o.spec),
  ]);
  const crossings = routingCrossings(routeBoard(o.spec, fps).traces);
  const field = "mt-1 w-full rounded-md border border-line-3 bg-g-1 px-3 text-[13.5px] text-t-1 outline-none focus:border-teal-400";
  return (
    <>
      <div className="fig mb-3">
        <Link href="/admin/siparisler" className="hover:text-t-1">← {a.nav.allOrders}</Link>
      </div>
      <PageHead
        title={`${a.admin.orderTitle} ${orderNo(o.number)}`}
        lede={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={ORDER_TONE[o.status]}>{a.orderStatus[o.status]}</Pill>
            <span className="fig">
              {row.title} · {row.member} ({row.email}) · {fmtDate(o.createdAt, lang, true)}
            </span>
          </span>
        }
      >
        <Link href={`/panel/p/${o.projectId}`} className="btn btn-ghost">{a.admin.open} →</Link>
      </PageHead>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="card grid gap-5 p-5 md:grid-cols-[220px_1fr]">
            <div className="flex h-36 items-center justify-center rounded-md bg-g-1 p-3">
              <BoardThumb spec={o.spec} fps={fps} />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <dt className="text-t-3">{a.panel.qty}</dt>
              <dd className="font-mono">{o.quantity}</dd>
              <dt className="text-t-3">{a.admin.size}</dt>
              <dd className="font-mono">{o.spec.width} × {o.spec.height} mm</dd>
              <dt className="text-t-3">{a.panel.parts}</dt>
              <dd className="font-mono">{o.spec.parts.length}</dd>
              <dt className="text-t-3">{a.panel.mask}</dt>
              <dd>{o.spec.finish.mask} · {o.spec.finish.surface.toUpperCase()} · silk {o.spec.finish.silk}</dd>
              <dt className="text-t-3">{a.panel.version}</dt>
              <dd className="font-mono">{o.specVersion}</dd>
              <dt className="text-t-3">{a.admin.routing}</dt>
              <dd className={crossings ? "text-warn" : "text-ok"}>{crossings ? a.admin.crossings.replace("{n}", String(crossings)) : "✓"}</dd>
            </dl>
            {o.note && <p className="rounded-md border border-line-2 bg-g-1 p-3 text-[13px] text-t-2 md:col-span-2">“{o.note}”</p>}
            <a href={`/api/orders/${o.id}/files`} className="btn btn-primary md:col-span-2 justify-center">↓ {a.admin.files}</a>
          </div>
          <div className="card p-5">
            <div className="eyebrow mb-4">{a.panel.timeline}</div>
            <OrderTimeline status={o.status} events={events} labels={a.orderStatus} lang={lang} />
          </div>
        </div>

        <form key={o.updatedAt.toISOString()} action={updateOrder.bind(null, o.id)} className="card space-y-4 self-start p-5">
          <div className="eyebrow">{a.admin.update}</div>
          <label className="block text-[12.5px] text-t-3">
            {a.panel.status}
            <select name="status" defaultValue={o.status} className={`${field} h-10`}>
              {ORDER_STATUS.map((s) => <option key={s} value={s}>{a.orderStatus[s]}</option>)}
            </select>
          </label>
          <label className="block text-[12.5px] text-t-3">
            {a.admin.partner}
            <select name="partnerId" defaultValue={o.partnerId ?? ""} className={`${field} h-10`}>
              <option value="">{a.admin.noPartner}</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>)}
            </select>
          </label>
          <label className="block text-[12.5px] text-t-3">
            {a.admin.quoteTry} · {fmtMoney(o.quoteCents, o.currency, lang)}
            <input name="quote" inputMode="decimal" defaultValue={o.quoteCents != null ? (o.quoteCents / 100).toFixed(2) : ""} className={`${field} h-10 font-mono`} />
          </label>
          <label className="block text-[12.5px] text-t-3">
            {a.panel.tracking}
            <input name="tracking" defaultValue={o.tracking} className={`${field} h-10 font-mono`} />
          </label>
          <label className="block text-[12.5px] text-t-3">
            {a.admin.eventNote}
            <textarea name="eventNote" rows={2} className={`${field} py-2`} />
          </label>
          <label className="block text-[12.5px] text-t-3">
            {a.admin.adminNote}
            <textarea name="adminNote" rows={3} defaultValue={o.adminNote} className={`${field} py-2`} />
          </label>
          <button className="btn btn-primary w-full justify-center">{a.admin.save}</button>
        </form>
      </div>
    </>
  );
}
