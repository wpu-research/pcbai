import Link from "next/link";
import type { Order } from "@/db/schema";
import type { AppDict } from "@/lib/dict-app";
import type { Lang } from "@/lib/dict";
import { fmtDate, fmtMoney, ORDER_TONE, orderNo } from "@/lib/format";
import { Pill } from "./Shell";

export function AdminOrdersTable({ rows, a, lang }: { rows: { o: Order; title: string; member: string; partner: string | null }[]; a: AppDict; lang: Lang }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13.5px]">
        <thead>
          <tr className="fig border-b border-line-2 text-left">
            {[a.panel.orderNo, a.panel.project, a.admin.member, a.panel.qty, a.panel.status, a.admin.partner, a.panel.quote, a.panel.created].map((h) => (
              <th key={h} className="px-4 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ o, title, member, partner }) => (
            <tr key={o.id} className="border-b border-line-1 last:border-0 hover:bg-[var(--wash-hover)]">
              <td className="px-4 py-3 font-mono">
                <Link href={`/admin/siparisler/${o.id}`} className="text-teal-300 hover:text-teal-200">{orderNo(o.number)}</Link>
              </td>
              <td className="px-4 py-3">{title}</td>
              <td className="px-4 py-3 text-t-2">{member}</td>
              <td className="px-4 py-3 font-mono">{o.quantity}</td>
              <td className="px-4 py-3"><Pill tone={ORDER_TONE[o.status]}>{a.orderStatus[o.status]}</Pill></td>
              <td className="px-4 py-3 text-t-2">{partner ?? <span className="text-t-4">{a.admin.noPartner}</span>}</td>
              <td className="px-4 py-3 font-mono">{fmtMoney(o.quoteCents, o.currency, lang)}</td>
              <td className="px-4 py-3 text-t-3">{fmtDate(o.createdAt, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
