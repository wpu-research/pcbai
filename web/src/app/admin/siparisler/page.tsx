import { AdminOrdersTable } from "@/components/app/AdminOrdersTable";
import { Empty, PageHead } from "@/components/app/Shell";
import { ORDER_STATUS, type OrderStatus } from "@/db/schema";
import { ordersWithContext } from "@/lib/admin-queries";
import { appT } from "@/lib/lang-server";
import Link from "next/link";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { a, lang } = await appT();
  const s = (await searchParams).s;
  const filter = ORDER_STATUS.includes(s as OrderStatus) ? [s as OrderStatus] : undefined;
  const rows = await ordersWithContext(filter);
  return (
    <>
      <PageHead title={a.nav.allOrders} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/siparisler" className={`chip ${!filter ? "!border-teal-300 !text-t-1" : ""}`}>{a.admin.all}</Link>
        {ORDER_STATUS.map((st) => (
          <Link key={st} href={`?s=${st}`} className={`chip ${s === st ? "!border-teal-300 !text-t-1" : ""}`}>{a.orderStatus[st]}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>{a.admin.none}</Empty> : <AdminOrdersTable rows={rows} a={a} lang={lang} />}
    </>
  );
}
