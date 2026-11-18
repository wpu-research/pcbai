import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { attachDesign } from "@/app/actions/admin";
import { Empty, PageHead, Pill } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { fmtDate } from "@/lib/format";
import { appT } from "@/lib/lang-server";
import { TEMPLATES } from "@/lib/pcb/templates";

export default async function AdminProjects() {
  const { a, lang } = await appT();
  const d = await db();
  const rows = await d
    .select({ p: schema.projects, member: schema.users.name, email: schema.users.email })
    .from(schema.projects)
    .innerJoin(schema.users, eq(schema.users.id, schema.projects.userId))
    .orderBy(desc(schema.projects.updatedAt))
    .limit(300);
  return (
    <>
      <PageHead title={a.nav.allProjects} />
      {rows.length === 0 ? (
        <Empty>{a.admin.none}</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map(({ p, member, email }) => (
            <div key={p.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Link href={`/panel/p/${p.id}`} className="font-display text-[17px] font-semibold hover:text-teal-200">{p.title}</Link>
                  <Pill tone={p.status === "design_requested" ? "warn" : p.status === "ready" ? "ok" : p.status === "ordered" ? "teal" : "muted"}>{a.projectStatus[p.status]}</Pill>
                </div>
                <span className="fig">
                  {member} · {email} · {a.panel.version} {p.version} · {fmtDate(p.updatedAt, lang)}
                </span>
              </div>
              {p.brief && <p className="mt-2 whitespace-pre-wrap text-[13px] text-t-2">{p.brief}</p>}
              {p.status === "design_requested" && (
                <form action={attachDesign.bind(null, p.id)} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-1 pt-3">
                  <span className="text-[12.5px] text-t-3">{a.admin.attachLede}</span>
                  <select name="template" className="h-9 rounded-md border border-line-3 bg-g-1 px-2 text-[13px]">
                    {Object.keys(TEMPLATES).map((k) => <option key={k} value={k}>{a.panel.templates[k]}</option>)}
                  </select>
                  <button className="btn btn-primary h-9">{a.admin.attach}</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
