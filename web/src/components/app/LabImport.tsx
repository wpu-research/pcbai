"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createFromLab } from "@/app/actions/projects";
import { useI18n } from "@/lib/i18n";
import { LAB_IMPORT_TEXT } from "@/lib/lab/import-text";
import { decodeLabFragment, IMPORT_FOOTPRINTS, labToBoard, parseLabExport, type LabExport } from "@/lib/lab/import";
import { partBox, runDrc } from "@/lib/pcb/drc";
import { loadFootprint } from "@/lib/pcb/geometry";
import { MASKS } from "@/lib/pcb/materials";
import type { Footprint } from "@/lib/pcb/types";

const KEEP = "pcbai.labImport";
const T = LAB_IMPORT_TEXT;


export function LabImport({ loggedIn }: { loggedIn: boolean }) {
  const { lang } = useI18n();
  const t = T[lang];
  const [lab, setLab] = useState<LabExport | null>(null);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const [fps, setFps] = useState<Map<string, Footprint> | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // a circuit arrives in the URL fragment (from the lab) or survives a sign-in round trip
  useEffect(() => {
    const fromHash = location.hash.length > 1 ? decodeLabFragment(location.hash) : null;
    let kept: LabExport | null = null;
    try {
      kept = parseLabExport(JSON.parse(sessionStorage.getItem(KEEP) ?? "null"));
    } catch {}
    const got = fromHash ?? kept;
    if (got) setLab(got);
    if (fromHash) history.replaceState(null, "", location.pathname);
  }, []);

  useEffect(() => {
    if (!lab) return;
    setFps(null);
    Promise.all(IMPORT_FOOTPRINTS(lab).map((k) => loadFootprint(k).then((f) => [k, f] as const))).then((r) => setFps(new Map(r)));
  }, [lab]);

  const result = useMemo(() => (lab && fps ? labToBoard(lab, { id: "preview", title: lab.name ?? t.title, lang }, (k) => fps.get(k)!.bbox) : null), [lab, fps, lang, t.title]);
  const issues = useMemo(() => (result && fps ? runDrc(result.spec, fps) : []), [result, fps]);

  const tryText = (s: string) => {
    try {
      const l = parseLabExport(JSON.parse(s));
      setBad(!l);
      if (l) setLab(l);
    } catch {
      setBad(true);
    }
  };

  const create = () => {
    if (!lab) return;
    if (!loggedIn) {
      try {
        sessionStorage.setItem(KEEP, JSON.stringify(lab));
      } catch {}
      location.href = "/giris?next=/aktar";
      return;
    }
    start(async () => {
      try {
        sessionStorage.removeItem(KEEP);
      } catch {}
      const r = await createFromLab(JSON.stringify(lab));
      if (r?.error) setError(r.error);
    });
  };

  if (!lab)
    return (
      <div className="max-w-[720px]">
        <p className="text-[14px] text-t-2">{t.paste}</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false} className="mt-3 w-full rounded-md border border-line-3 bg-g-1 p-3 font-mono text-[12px] text-t-1 outline-none focus:border-teal-400" placeholder='{"v":1,"circuit":{"parts":[...],"wires":[...]},"code":"..."}' />
        {bad && <p className="mt-2 text-[13px] text-crit">{t.invalid}</p>}
        <div className="mt-3 flex gap-3">
          <button onClick={() => tryText(text)} className="btn btn-primary">{t.preview}</button>
          <label className="btn btn-ghost cursor-pointer">
            {t.file}
            <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) tryText(await f.text()); }} />
          </label>
        </div>
      </div>
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-6">
        <div className="card flex h-[340px] items-center justify-center bg-g-1 p-6">
          {result && fps ? (
            <svg viewBox={`-4 -4 ${result.spec.width + 8} ${result.spec.height + 8}`} className="h-full w-full">
              <rect width={result.spec.width} height={result.spec.height} rx={result.spec.radius} fill={MASKS[result.spec.finish.mask].three} stroke="#d3c39c" strokeWidth={0.3} />
              {result.spec.holes.map((h, i) => <circle key={i} cx={h.x} cy={h.y} r={h.d / 2 + 1.1} fill="#d6b46c" stroke="#070708" strokeWidth={h.d * 0.6} />)}
              {result.spec.parts.map((p) => {
                const b = partBox(fps.get(p.footprint)!, p);
                const lab = p.group === "Lab";
                return (
                  <g key={p.ref}>
                    <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.4} fill={lab ? "#5bbfcd26" : "#2a2c30"} stroke={lab ? "#7ed0dd" : "#ffffff22"} strokeWidth={0.25} />
                    <text x={(b.x0 + b.x1) / 2} y={(b.y0 + b.y1) / 2 + 0.5} textAnchor="middle" fontSize={1.4} fill={lab ? "#9fdee7" : "#8a8984"} fontFamily="monospace">{p.ref}</text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <span className="fig">…</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={create} disabled={pending || !result} className="btn btn-primary h-11 px-6 disabled:opacity-60">
            {pending ? "…" : loggedIn ? t.create : t.login}
          </button>
          <button onClick={() => { setLab(null); try { sessionStorage.removeItem(KEEP); } catch {} }} className="text-[13px] text-t-3 hover:text-t-1">{t.other}</button>
          {result && <span className={`text-[13px] ${issues.length ? "text-warn" : "text-ok"}`}>{issues.length ? t.drcBad : `✓ ${t.drcOk}`}</span>}
          {error && <span className="text-[13px] text-crit">{error}</span>}
        </div>
      </div>
      {result && (
        <div className="space-y-5">
          <div>
            <div className="eyebrow mb-2">{t.mapping}</div>
            <div className="overflow-hidden rounded-lg border border-line-2">
              <div className="fig grid grid-cols-[1fr_1.4fr] border-b border-line-2 bg-g-2 px-3 py-2"><span>{t.lab}</span><span>{t.board}</span></div>
              {result.rows.map((r) => (
                <div key={r.labId} className="grid grid-cols-[1fr_1.4fr] gap-3 border-b border-line-1 px-3 py-2 text-[13px] last:border-0">
                  <span className="font-mono text-t-2">{r.labType}</span>
                  <span className="text-t-1"><span className="mr-2 font-mono text-teal-300">{r.ref}</span>{r.name}</span>
                </div>
              ))}
            </div>
          </div>
          {result.pinMap.length > 0 && (
            <div>
              <div className="eyebrow mb-2">{t.pins}</div>
              <div className="flex flex-wrap gap-2">
                {result.pinMap.map((m) => <span key={m.uno} className="chip font-mono !text-[12px]">{m.uno} → {m.esp}</span>)}
              </div>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div>
              <div className="eyebrow mb-2">{t.notes}</div>
              <ul className="space-y-1 text-[13px] text-warn">{result.warnings.map((w) => <li key={w}>● {w}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

