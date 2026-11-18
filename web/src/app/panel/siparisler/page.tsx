import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Empty, PageHead, Pill } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney, ORDER_TONE, orderNo } from "@/lib/format";
import { appT } from "@/lib/lang-server";

export default async function MemberOrders() {
  const user = await requireUser();
  const { a, lang } = await appT();
  const d = await db();
  const rows = await d
    .select({ o: schema.orders, title: schema.projects.title })
    .from(schema.orders)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.orders.projectId))
    .where(eq(schema.orders.userId, user.id))
    .orderBy(desc(schema.orders.createdAt));
  return (
    <>
      <PageHead title={a.nav.orders} lede={a.panel.ordersLede} />
      {rows.length === 0 ? (
        <Empty>{a.panel.noOrders}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <thead>
              <tr className="fig border-b border-line-2 text-left">
                {[a.panel.orderNo, a.panel.project, a.panel.qty, a.panel.status, a.panel.quote, a.panel.created].map((h) => (
                  <th key={h} className="px-4 py-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, title }) => (
                <tr key={o.id} className="border-b border-line-1 last:border-0 hover:bg-[var(--wash-hover)]">
                  <td className="px-4 py-3 font-mono">{orderNo(o.number)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/panel/p/${o.projectId}?tab=order`} className="hover:text-teal-200">{title}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono">{o.quantity}</td>
                  <td className="px-4 py-3"><Pill tone={ORDER_TONE[o.status]}>{a.orderStatus[o.status]}</Pill></td>
                  <td className="px-4 py-3 font-mono">{fmtMoney(o.quoteCents, o.currency, lang)}</td>
                  <td className="px-4 py-3 text-t-3">{fmtDate(o.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
