import { asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveQuote, cancelOrder, deleteProject, ownedProject, renameProject, requestQuote } from "@/app/actions/projects";
import { BoardEditor } from "@/components/app/BoardEditor";
import { OrderTimeline } from "@/components/app/OrderTimeline";
import { PageHead, Pill } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { fileList } from "@/lib/files";
import { fmtDate, fmtMoney, ORDER_TONE, orderNo } from "@/lib/format";
import { appT } from "@/lib/lang-server";
import { runDrc } from "@/lib/pcb/drc";
import { serverFootprints } from "@/lib/pcb/server";

const TABS = ["board", "files", "order"] as const;

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const owned = await ownedProject(id);
  if (!owned) notFound();
  const { project, user } = owned;
  const { a, lang } = await appT();
  const tab = (TABS as readonly string[]).includes((await searchParams).tab ?? "") ? ((await searchParams).tab as (typeof TABS)[number]) : "board";
  const readOnly = user.role !== "admin" && project.userId !== user.id;

  const d = await db();
  const orders = await d.select().from(schema.orders).where(eq(schema.orders.projectId, project.id)).orderBy(desc(schema.orders.createdAt));
  const events = orders.length ? await d.select().from(schema.orderEvents).where(inArray(schema.orderEvents.orderId, orders.map((o) => o.id))).orderBy(asc(schema.orderEvents.createdAt)) : [];
  const drcCount = project.spec ? runDrc(project.spec, await serverFootprints(project.spec)).length : 0;

  return (
    <>
      <div className="fig mb-3">
        <Link href="/panel" className="hover:text-t-1">
          ← {a.nav.projects}
        </Link>
      </div>
      <PageHead
        title={
          <form action={renameProject.bind(null, project.id)} className="flex items-center gap-3">
            <input
              name="title"
              defaultValue={project.title}
              maxLength={80}
              aria-label={a.panel.fTitle}
              className="w-[min(520px,70vw)] rounded-md border border-transparent bg-transparent px-1 font-display text-[30px] font-semibold tracking-tight outline-none hover:border-line-2 focus:border-teal-400"
            />
          </form>
        }
        lede={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={project.status === "ready" ? "ok" : project.status === "ordered" ? "teal" : project.status === "design_requested" ? "warn" : "muted"}>{a.projectStatus[project.status]}</Pill>
            <span className="fig">
              {a.panel.version} {project.version} · {a.panel.updated} {fmtDate(project.updatedAt, lang, true)}
            </span>
          </span>
        }
      >
        <form action={deleteProject.bind(null, project.id)}>
          <button className="text-[12.5px] text-t-3 hover:text-crit">{a.admin.delete}</button>
        </form>
      </PageHead>

      {!project.spec ? (
        <div className="card max-w-[720px] p-6">
          <div className="eyebrow">{a.panel.yourBrief}</div>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7">{project.brief || "—"}</p>
          <p className="mt-6 flex items-center gap-2 border-t border-line-1 pt-4 text-[13.5px] text-t-2">
            <span className="h-2 w-2 rounded-full bg-warn" style={{ animation: "pulse-dot 1.4s infinite" }} />
            {a.panel.designRequested}
          </p>
        </div>
      ) : (
        <>
          <nav className="mb-6 flex gap-1 border-b border-line-1">
            {TABS.map((t) => (
              <Link
                key={t}
                href={`?tab=${t}`}
                scroll={false}
                className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] ${tab === t ? "border-teal-300 text-t-1" : "border-transparent text-t-3 hover:text-t-2"}`}
              >
                {a.panel.tabs[t]}
                {t === "order" && orders.length > 0 && <span className="ml-2 font-mono text-[11px] text-t-3">{orders.length}</span>}
              </Link>
            ))}
          </nav>

          {tab === "board" && <BoardEditor projectId={project.id} initial={project.spec} version={project.version} readOnly={readOnly} />}

          {tab === "files" && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div>
                <p className="text-[14px] text-t-2">{a.panel.filesLede}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={`/api/projects/${project.id}/files`} className="btn btn-primary">
                    ↓ {a.panel.downloadAll}
                  </a>
                  <a href={`/api/projects/${project.id}/drawing?download`} className="btn btn-ghost">
                    ↓ {a.panel.downloadSvg}
                  </a>
                </div>
                <table className="mt-6 w-full text-[13px]">
                  <thead>
                    <tr className="fig border-b border-line-2 text-left">
                      <th className="py-2 font-normal">{a.panel.fileTable.name}</th>
                      <th className="py-2 font-normal">{a.panel.fileTable.what}</th>
                      <th className="py-2 text-right font-normal">{a.panel.fileTable.size}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(await fileList(project.spec)).map((f) => {
                      const key = f.name.replace(/^.*?-(F_|B_|Edge|PTH|NPTH|bom|cpl|README)/, "$1").replace(/\.\w+$/, "");
                      return (
                        <tr key={f.name} className="border-b border-line-1">
                          <td className="py-2 font-mono text-[12px] text-t-1">{f.name}</td>
                          <td className="py-2 text-t-2">{a.panel.fileWhat[key] ?? ""}</td>
                          <td className="py-2 text-right font-mono text-[12px] text-t-3">{(f.size / 1024).toFixed(1)} KB</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <figure>
                {project.sketch && (
                  <div className="mb-6">
                    <div className="eyebrow mb-2">{a.panel.firmware}</div>
                    <pre className="max-h-[320px] overflow-auto rounded-md border border-line-2 bg-g-0 p-3 font-mono text-[12px] leading-[18px] text-t-2">{project.sketch}</pre>
                  </div>
                )}
                <div className="overflow-hidden rounded-lg border border-line-2 bg-white">
                  {/* rendered as an image so the SVG can never run script */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/projects/${project.id}/drawing?v=${project.version}`} alt={a.panel.drawing} className="w-full" />
                </div>
                <figcaption className="fig mt-2">
                  <b>{a.panel.drawing}</b> · {project.spec.width} × {project.spec.height} mm · {a.panel.version} {project.version}
                </figcaption>
              </figure>
            </div>
          )}

          {tab === "order" && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="card self-start p-5">
                <p className="text-[14px] leading-6 text-t-2">{a.panel.orderLede}</p>
                {drcCount > 0 ? (
                  <p className="mt-4 rounded-md border border-[#f08a7e55] bg-[#f08a7e14] px-3 py-2 text-[13px] text-crit">{a.panel.drcBlocks}</p>
                ) : (
                  !readOnly && (
                    <form action={requestQuote.bind(null, project.id)} className="mt-4 space-y-3">
                      <label className="block text-[12.5px] text-t-3">
                        {a.panel.quantity}
                        <input name="quantity" type="number" min={1} max={1000} defaultValue={5} className="mt-1 h-10 w-32 rounded-md border border-line-3 bg-g-1 px-3 font-mono text-t-1" />
                      </label>
                      <label className="block text-[12.5px] text-t-3">
                        {a.panel.note}
                        <textarea name="note" rows={3} maxLength={2000} className="mt-1 w-full rounded-md border border-line-3 bg-g-1 px-3 py-2 text-[13.5px] text-t-1" />
                      </label>
                      <button className="btn btn-primary">{a.panel.requestQuote}</button>
                    </form>
                  )
                )}
              </div>
              <div>
                <div className="eyebrow mb-3">{a.panel.yourOrders}</div>
                {orders.length === 0 ? (
                  <p className="text-[13.5px] text-t-3">{a.panel.noOrders}</p>
                ) : (
                  <div className="space-y-4">
                    {orders.map((o) => (
                      <div key={o.id} className="card p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[15px]">
                              {a.panel.orderNo} {orderNo(o.number)}
                            </span>
                            <Pill tone={ORDER_TONE[o.status]}>{a.orderStatus[o.status]}</Pill>
                          </div>
                          <span className="fig">
                            {o.quantity} × · {a.panel.version} {o.specVersion} · {fmtDate(o.createdAt, lang)}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                          <OrderTimeline status={o.status} events={events.filter((e) => e.orderId === o.id)} labels={a.orderStatus} lang={lang} />
                          <div className="space-y-2 text-right text-[13px] sm:min-w-[180px]">
                            <div>
                              <div className="fig">{a.panel.quote}</div>
                              <div className="font-display text-[22px] font-semibold">{fmtMoney(o.quoteCents, o.currency, lang)}</div>
                            </div>
                            {o.tracking && (
                              <div>
                                <div className="fig">{a.panel.tracking}</div>
                                <div className="font-mono text-teal-200">{o.tracking}</div>
                              </div>
                            )}
                            {!readOnly && o.status === "quoted" && (
                              <form action={approveQuote.bind(null, o.id)}>
                                <button className="btn btn-primary w-full justify-center">{a.panel.approve}</button>
                              </form>
                            )}
                            {!readOnly && ["quote_requested", "quoted"].includes(o.status) && (
                              <form action={cancelOrder.bind(null, o.id)}>
                                <button className="text-[12px] text-t-3 hover:text-crit">{a.panel.cancel}</button>
                              </form>
                            )}
                            <a href={`/api/orders/${o.id}/files`} className="fig block hover:text-t-1">
                              ↓ {a.panel.downloadAll}
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
