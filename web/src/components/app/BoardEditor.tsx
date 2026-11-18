"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveBoard } from "@/app/actions/projects";
import { APP } from "@/lib/dict-app";
import { PART_TR } from "@/lib/dict";
import { useI18n } from "@/lib/i18n";
import { partBox, routingCrossings, runDrc, type DrcIssue } from "@/lib/pcb/drc";
import { loadFootprint, padsOf, routeBoard, toBoard } from "@/lib/pcb/geometry";
import { MASKS } from "@/lib/pcb/materials";
import { LIMITS, MASK_NAMES, shortPkg, swapGroup } from "@/lib/pcb/templates";
import type { BoardSpec, Footprint, MaskName, PartSpec } from "@/lib/pcb/types";

const EditorScene = dynamic(() => import("./EditorScene"), { ssr: false });
const Stage = dynamic(() => import("../three/Stage"), { ssr: false });

const SNAP = 0.25;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function BoardEditor({ projectId, initial, version, readOnly = false }: { projectId: string; initial: BoardSpec; version: number; readOnly?: boolean }) {
  const { lang } = useI18n();
  const p = APP[lang].panel;
  const router = useRouter();
  const [spec, setSpec] = useState<BoardSpec>(initial);
  const [base, setBase] = useState<BoardSpec>(initial);
  const [fps, setFps] = useState<Map<string, Footprint> | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [rev, setRev] = useState(0);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ ref: string; dx: number; dy: number } | null>(null);

  // footprints for every package the board can use (including swap targets)
  useEffect(() => {
    // one missing package must not take the editor down: load each on its own, keep what arrives
    const keys = [...new Set(initial.parts.flatMap((x) => swapGroup(x.footprint)))];
    Promise.all(keys.map((k) => loadFootprint(k).then((fp) => [k, fp] as const, () => null))).then((r) =>
      setFps(new Map(r.filter((x): x is readonly [string, Footprint] => x !== null))),
    );
  }, [initial]);

  useEffect(() => {
    setSpec(initial);
    setBase(initial);
  }, [initial]);

  const dirty = useMemo(() => JSON.stringify(spec) !== JSON.stringify(base), [spec, base]);
  const routed = useMemo(() => (fps ? routeBoard(spec, fps) : null), [spec, fps]);
  const issues = useMemo<DrcIssue[]>(() => (fps ? runDrc(spec, fps) : []), [spec, fps]);
  const crossings = useMemo(() => (routed ? routingCrossings(routed.traces) : 0), [routed]);
  const bad = useMemo(() => new Set(issues.flatMap((i) => i.refs)), [issues]);

  // 3D follows edits after a short pause; a new id makes the board rebuild
  useEffect(() => {
    if (view !== "3d") return;
    const id = setTimeout(() => setRev((r) => r + 1), 350);
    return () => clearTimeout(id);
  }, [spec, view]);
  const spec3d = useMemo(() => ({ ...spec, id: `${spec.id}-e${rev}` }), [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const part = spec.parts.find((x) => x.ref === sel) ?? null;
  const name = (x: PartSpec) => (lang === "tr" ? PART_TR[x.ref]?.name : undefined) ?? x.name;

  const update = useCallback(
    (ref: string, f: (x: PartSpec) => Partial<PartSpec>) => {
      if (readOnly) return;
      setSpec((s) => ({ ...s, parts: s.parts.map((x) => (x.ref === ref ? { ...x, ...f(x) } : x)) }));
    },
    [readOnly],
  );

  // keyboard: R rotate, arrows nudge, Esc deselect
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!sel || (e.target as HTMLElement)?.closest("input,select,textarea")) return;
      const step = e.shiftKey ? 1 : SNAP;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (e.key === "r" || e.key === "R") update(sel, (x) => ({ rot: (x.rot + 90) % 360 }));
      else if (moves[e.key]) {
        e.preventDefault();
        update(sel, (x) => ({ x: r2(x.x + moves[e.key][0]), y: r2(x.y + moves[e.key][1]) }));
      } else if (e.key === "Escape") setSel(null);
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [sel, update]);

  const toBoardPt = (e: React.PointerEvent) => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [pt.x, pt.y] as const;
  };

  const onDown = (e: React.PointerEvent, x: PartSpec) => {
    e.stopPropagation();
    setSel(x.ref);
    if (readOnly) return;
    const [bx, by] = toBoardPt(e);
    drag.current = { ref: x.ref, dx: bx - x.x, dy: by - x.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const [bx, by] = toBoardPt(e);
    update(d.ref, () => ({ x: snap(bx - d.dx), y: snap(by - d.dy) }));
  };
  const onUp = () => (drag.current = null);

  const save = () =>
    start(async () => {
      const res = await saveBoard(projectId, { width: spec.width, height: spec.height, finish: spec.finish, parts: spec.parts });
      if (res.ok) {
        setBase(spec);
        setSavedAt(Date.now());
        router.refresh();
      }
    });

  const M = 6;
  const issueText = (i: DrcIssue) => `${i.refs.join(" ↔ ")} ${i.kind === "out" ? p.drcOut : i.kind === "overlap" ? p.drcOverlap : p.drcHole}`;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      {/* canvas */}
      <div className="card relative overflow-hidden !bg-transparent">
        <div className="relative z-[3] flex items-center justify-between border-b border-line-1 px-3 py-2">
          <div className="flex rounded-md border border-line-2 p-0.5 text-[12.5px]">
            {(["2d", "3d"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-[3px] px-3 py-1 ${view === v ? "bg-g-4 text-t-1" : "text-t-3 hover:text-t-2"}`}>
                {v === "2d" ? p.view2d : p.view3d}
              </button>
            ))}
          </div>
          <span className="fig">
            {spec.width} × {spec.height} mm · {spec.parts.length} {p.parts} · {p.version} {version}
          </span>
        </div>
        <div className="relative h-[min(64vh,600px)] bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]">
          {view === "2d" ? (
            <svg
              ref={svg}
              viewBox={`${-M} ${-M} ${spec.width + 2 * M} ${spec.height + 2 * M}`}
              className="absolute inset-0 h-full w-full touch-none select-none"
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerDown={() => setSel(null)}
            >
              <rect width={spec.width} height={spec.height} rx={Math.min(spec.radius, spec.width / 2, spec.height / 2)} fill="#141416" stroke="#d3c39c" strokeWidth={0.25} />
              <rect width={spec.width} height={spec.height} rx={Math.min(spec.radius, spec.width / 2, spec.height / 2)} fill={MASKS[spec.finish.mask].three} opacity={0.35} />
              {/* traces */}
              {routed?.traces.map((t, i) => (
                <polyline key={i} points={t.points.map((q) => q.join(",")).join(" ")} fill="none" stroke={t.kind === "ground" ? "#7198df" : t.kind === "power" ? "#eda66e" : t.kind === "usb" ? "#98bdee" : "#d99763"} strokeOpacity={0.8} strokeWidth={t.width} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {routed?.vias.map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={0.45} fill="#cdcac5" />
                  <circle cx={x} cy={y} r={0.2} fill="#070708" />
                </g>
              ))}
              {spec.holes.map((h, i) => (
                <g key={i}>
                  <circle cx={h.x} cy={h.y} r={h.d / 2 + 1.3} fill="#d6b46c" />
                  <circle cx={h.x} cy={h.y} r={h.d / 2} fill="#070708" />
                </g>
              ))}
              {/* parts */}
              {fps &&
                spec.parts.map((x) => {
                  const fp = fps.get(x.footprint);
                  if (!fp) return null;
                  const b = partBox(fp, x);
                  const on = x.ref === sel, err = bad.has(x.ref);
                  return (
                    <g key={x.ref} onPointerDown={(e) => onDown(e, x)} className={readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}>
                      <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} fill={on ? "#5bbfcd22" : "#ffffff06"} stroke={err ? "#f08a7e" : on ? "#7ed0dd" : "#ffffff30"} strokeWidth={on || err ? 0.3 : 0.15} strokeDasharray={on || err ? undefined : "0.6 0.4"} rx={0.3} />
                      {padsOf(fp).map((pd, i) => {
                        const [cx, cy] = toBoard(x, pd.x, pd.y);
                        const rr = pd.shape === "circle" || pd.shape === "oval" ? Math.min(pd.w, pd.h) / 2 : pd.shape === "roundrect" ? Math.min(pd.w, pd.h) * 0.25 : 0;
                        return <rect key={i} x={-pd.w / 2} y={-pd.h / 2} width={pd.w} height={pd.h} rx={rr} transform={`translate(${cx} ${cy}) rotate(${x.rot + (pd.rotation || 0)})`} fill={on ? "#f7d3b2" : "#eebd8c"} />;
                      })}
                      <text x={(b.x0 + b.x1) / 2} y={b.y0 - 0.5} textAnchor="middle" fontSize={Math.min(1.6, Math.max(0.9, (b.x1 - b.x0) / 3))} fill={on ? "#9fdee7" : err ? "#f7a89d" : "#b5b4b0"} fontFamily="var(--font-mono)">
                        {x.ref}
                      </text>
                    </g>
                  );
                })}
            </svg>
          ) : (
            <div className="pool absolute inset-0">
              <EditorScene spec={spec3d} />
            </div>
          )}
        </div>
        <div className="relative z-[3] flex flex-wrap gap-x-4 gap-y-1 border-t border-line-1 px-3 py-2 font-mono text-[10.5px] text-t-3">
          <span><i className="mr-1 inline-block h-2 w-3 bg-[#eda66e] align-middle" />power</span>
          <span><i className="mr-1 inline-block h-2 w-3 bg-[#d99763] align-middle" />signal</span>
          <span><i className="mr-1 inline-block h-2 w-3 bg-[#98bdee] align-middle" />USB</span>
          <span><i className="mr-1 inline-block h-2 w-3 bg-[#7198df] align-middle" />GND → via</span>
          <span className="ml-auto">{p.noneSelected}</span>
        </div>
      </div>

      {/* inspector */}
      <div className="space-y-4">
        {!readOnly && (
          <div className="card flex items-center gap-2 p-3">
            <button onClick={save} disabled={!dirty || pending} className="btn btn-primary flex-1 justify-center disabled:opacity-50">
              {pending ? p.saving : p.save}
            </button>
            <button onClick={() => setSpec(base)} disabled={!dirty || pending} className="btn btn-ghost disabled:opacity-40">
              {p.reset}
            </button>
            <span className="fig w-full basis-full text-center">{dirty ? p.unsaved : savedAt ? `✓ ${p.saved}` : ""}</span>
          </div>
        )}

        <div className="card p-4">
          <div className="eyebrow">{p.boardSettings}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["width", "height"] as const).map((k) => (
              <label key={k} className="text-[12px] text-t-3">
                {p[k]} (mm)
                <input
                  type="number"
                  min={LIMITS.min}
                  max={LIMITS.max}
                  step={0.5}
                  value={spec[k]}
                  disabled={readOnly}
                  onChange={(e) => setSpec((s) => ({ ...s, [k]: Math.min(LIMITS.max, Math.max(LIMITS.min, Number(e.target.value) || s[k])) }))}
                  className="mt-1 h-9 w-full rounded-md border border-line-3 bg-g-1 px-2 font-mono text-[13px] text-t-1 outline-none focus:border-teal-400"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 text-[12px] text-t-3">{p.mask}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {MASK_NAMES.map((m) => (
              <button
                key={m}
                title={m}
                disabled={readOnly}
                onClick={() => setSpec((s) => ({ ...s, finish: { ...s.finish, mask: m as MaskName, silk: m === "white" ? "black" : "white" } }))}
                className={`h-7 w-7 rounded-md border-2 ${spec.finish.mask === m ? "border-teal-300" : "border-line-2"}`}
                style={{ background: MASKS[m as MaskName].three }}
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-[12px] text-t-3">
              {p.finish}
              <select
                value={spec.finish.surface}
                disabled={readOnly}
                onChange={(e) => setSpec((s) => ({ ...s, finish: { ...s.finish, surface: e.target.value as "enig" | "hasl" } }))}
                className="mt-1 h-9 w-full rounded-md border border-line-3 bg-g-1 px-2 text-[13px] text-t-1"
              >
                <option value="enig">ENIG</option>
                <option value="hasl">HASL</option>
              </select>
            </label>
            <label className="text-[12px] text-t-3">
              {p.silk}
              <select
                value={spec.finish.silk}
                disabled={readOnly}
                onChange={(e) => setSpec((s) => ({ ...s, finish: { ...s.finish, silk: e.target.value as "white" | "black" } }))}
                className="mt-1 h-9 w-full rounded-md border border-line-3 bg-g-1 px-2 text-[13px] text-t-1"
              >
                <option value="white">white</option>
                <option value="black">black</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card p-4">
          <div className="eyebrow">{p.selected}</div>
          {part ? (
            <div className="mt-3 space-y-3">
              <div>
                <span className="font-mono text-[13px] text-teal-300">{part.ref}</span> <span className="text-[13.5px]">{name(part)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["x", "y", "rot"] as const).map((k) => (
                  <label key={k} className="text-[11.5px] text-t-3">
                    {p[k]}
                    <input
                      type="number"
                      step={k === "rot" ? 90 : SNAP}
                      value={part[k]}
                      disabled={readOnly}
                      onChange={(e) => update(part.ref, () => ({ [k]: k === "rot" ? ((Math.round(Number(e.target.value) / 90) * 90) % 360 + 360) % 360 : r2(Number(e.target.value)) }))}
                      className="mt-1 h-8 w-full rounded-md border border-line-3 bg-g-1 px-2 font-mono text-[12.5px] text-t-1"
                    />
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button disabled={readOnly} onClick={() => update(part.ref, (x) => ({ rot: (x.rot + 90) % 360 }))} className="btn btn-ghost h-8 flex-1 justify-center text-[12.5px]">
                  ⟳ {p.rotate}
                </button>
                {swapGroup(part.footprint).filter((f) => fps?.has(f)).length > 1 && (
                  <select
                    value={part.footprint}
                    disabled={readOnly}
                    onChange={(e) => update(part.ref, () => ({ footprint: e.target.value }))}
                    className="h-8 rounded-md border border-line-3 bg-g-1 px-2 font-mono text-[12px] text-t-1"
                    aria-label={p.swap}
                  >
                    {swapGroup(part.footprint).filter((f) => fps?.has(f)).map((f) => (
                      <option key={f} value={f}>
                        {shortPkg(f)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] leading-5 text-t-3">{p.noneSelected}</p>
          )}
        </div>

        <div className="card p-4">
          <div className="eyebrow">{p.drc}</div>
          {issues.length === 0 ? (
            <p className="mt-2 text-[13px] text-ok">✓ {p.drcOk}</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-[12.5px] text-crit">
              {issues.slice(0, 8).map((i, k) => (
                <li key={k}>
                  <button className="text-left hover:underline" onClick={() => setSel(i.refs[0])}>
                    ● {issueText(i)}
                  </button>
                </li>
              ))}
              {issues.length > 8 && <li className="text-t-3">+{issues.length - 8}</li>}
            </ul>
          )}
          {crossings > 0 && (
            <p className="mt-3 border-t border-line-1 pt-3 text-[12px] leading-5 text-warn">
              {lang === "tr"
                ? `Yol çizimi: ${crossings} iz kesişmesi. Önizleme yönlendiricisi basittir; üretimden önce otomatik yönlendirici ve mühendis kontrolüyle düzeltilir.`
                : `Routing: ${crossings} trace crossings. The preview router is simple; routing is redone by the autorouter and checked by an engineer before fabrication.`}
            </p>
          )}
        </div>
      </div>
      <Stage />
    </div>
  );
}
