import { asc, count, eq } from "drizzle-orm";
import { deletePartner, savePartner } from "@/app/actions/admin";
import { PageHead, Pill } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { PARTNER_STATUS, type Partner } from "@/db/schema";
import type { AppDict } from "@/lib/dict-app";
import { appT } from "@/lib/lang-server";

function PartnerForm({ p, a }: { p?: Partner; a: AppDict }) {
  const f = "mt-1 w-full rounded-md border border-line-3 bg-g-1 px-3 text-[13.5px] text-t-1 outline-none focus:border-teal-400";
  const input = (name: keyof Partner, label: string, ph = "") => (
    <label className="block text-[12px] text-t-3">
      {label}
      <input name={name} defaultValue={(p?.[name] as string) ?? ""} placeholder={ph} className={`${f} h-9`} />
    </label>
  );
  return (
    <form action={savePartner} className="grid gap-3 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      {input("name", a.admin.pName)}
      {input("city", a.admin.pCity)}
      {input("contactName", a.admin.pContact)}
      {input("phone", a.admin.pPhone)}
      {input("email", a.admin.pEmail)}
      {input("website", a.admin.pWebsite)}
      <div className="sm:col-span-2">{input("services", a.admin.pServices, a.admin.pServicesPh)}</div>
      {input("leadTime", a.admin.pLead)}
      <label className="block text-[12px] text-t-3">
        {a.admin.pStatus}
        <select name="status" defaultValue={p?.status ?? "talking"} className={`${f} h-9`}>
          {PARTNER_STATUS.map((s) => <option key={s} value={s}>{a.partnerStatus[s]}</option>)}
        </select>
      </label>
      <label className="block text-[12px] text-t-3 sm:col-span-2">
        {a.admin.pNotes}
        <textarea name="notes" rows={3} defaultValue={p?.notes ?? ""} className={`${f} py-2`} />
      </label>
      <div className="sm:col-span-2">
        <button className="btn btn-primary">{a.admin.save}</button>
      </div>
    </form>
  );
}

export default async function Partners() {
  const { a } = await appT();
  const d = await db();
  const rows = await d
    .select({ p: schema.partners, orders: count(schema.orders.id) })
    .from(schema.partners)
    .leftJoin(schema.orders, eq(schema.orders.partnerId, schema.partners.id))
    .groupBy(schema.partners.id)
    .orderBy(asc(schema.partners.name));
  return (
    <>
      <PageHead title={a.nav.partners} lede={a.admin.partnersLede} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {rows.length === 0 && <p className="text-[13.5px] text-t-3">{a.admin.none}</p>}
          {rows.map(({ p, orders }) => (
            <details key={p.id} className="card group p-5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-[18px] font-semibold">{p.name}</span>
                  <Pill tone={p.status === "active" ? "ok" : p.status === "talking" ? "warn" : "muted"}>{a.partnerStatus[p.status]}</Pill>
                </div>
                <span className="fig">
                  {[p.city, p.services, p.leadTime].filter(Boolean).join(" · ")} · {orders} {a.nav.allOrders.toLowerCase()}
                </span>
              </summary>
              <div className="mt-4 border-t border-line-1 pt-4">
                {(p.contactName || p.email || p.phone) && (
                  <p className="mb-4 text-[13px] text-t-2">
                    {p.contactName} {p.email && <a className="text-teal-300" href={`mailto:${p.email}`}>{p.email}</a>} {p.phone}
                  </p>
                )}
                <PartnerForm p={p} a={a} />
                <form action={deletePartner.bind(null, p.id)} className="mt-3 text-right">
                  <button className="text-[12px] text-t-3 hover:text-crit">{a.admin.delete}</button>
                </form>
              </div>
            </details>
          ))}
        </div>
        <div className="card self-start p-5">
          <div className="eyebrow mb-4">{a.admin.addPartner}</div>
          <PartnerForm a={a} />
        </div>
      </div>
    </>
  );
}
