import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { BoardThumb } from "@/components/app/BoardThumb";
import { Empty, PageHead, Pill } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { appT } from "@/lib/lang-server";
import { serverFootprints } from "@/lib/pcb/server";

export default async function Projects() {
  const user = await requireUser();
  const { a, lang } = await appT();
  const d = await db();
  const list = await d.select().from(schema.projects).where(eq(schema.projects.userId, user.id)).orderBy(desc(schema.projects.updatedAt));
  const thumbs = await Promise.all(list.map(async (p) => (p.spec ? serverFootprints(p.spec) : null)));
  return (
    <>
      <PageHead title={`${a.panel.hello}, ${user.name.split(" ")[0]}`} lede={a.panel.projectsLede}>
        <Link href="/panel/yeni" className="btn btn-primary">
          + {a.nav.newProject}
        </Link>
      </PageHead>
      {list.length === 0 ? (
        <Empty>
          {a.panel.empty}{" "}
          <Link href="/panel/yeni" className="text-teal-300 hover:text-teal-200">
            {a.panel.emptyCta} →
          </Link>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => (
            <Link key={p.id} href={`/panel/p/${p.id}`} className="card group overflow-hidden transition-colors hover:border-line-3">
              <div className="pool flex h-44 items-center justify-center border-b border-line-1 bg-g-1 p-5">
                {p.spec && thumbs[i] ? <BoardThumb spec={p.spec} fps={thumbs[i]!} /> : <span className="fig text-center">{a.projectStatus.design_requested}…</span>}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-[18px] font-semibold tracking-tight group-hover:text-teal-200">{p.title}</h2>
                  <Pill tone={p.status === "ready" ? "ok" : p.status === "ordered" ? "teal" : p.status === "design_requested" ? "warn" : "muted"}>{a.projectStatus[p.status]}</Pill>
                </div>
                <div className="fig mt-2">
                  {p.spec ? `${p.spec.width} × ${p.spec.height} mm · ${p.spec.parts.length} ${a.panel.parts} · ` : ""}
                  {a.panel.version} {p.version} · {a.panel.updated} {fmtDate(p.updatedAt, lang)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
