"use client";

import { useState } from "react";
import { APP } from "@/lib/dict-app";
import { useI18n } from "@/lib/i18n";
import { MASKS } from "@/lib/pcb/materials";
import { TEMPLATES } from "@/lib/pcb/templates";

export function NewProjectForm({ action }: { action: (f: FormData) => Promise<void> }) {
  const { lang } = useI18n();
  const p = APP[lang].panel;
  const [start, setStart] = useState<"template" | "brief" | "lab">("template");
  const [tpl, setTpl] = useState("field-node");
  const field = "mt-1.5 w-full rounded-md border border-line-3 bg-g-1 px-3 text-[14.5px] text-t-1 outline-none focus:border-teal-400";
  const opt = (k: typeof start, label: string) => (
    <button type="button" onClick={() => setStart(k)} className={`rounded-md border px-3 py-2 text-left text-[13.5px] ${start === k ? "border-teal-300 bg-teal-tint text-t-1" : "border-line-2 text-t-2 hover:border-line-3"}`}>
      {label}
    </button>
  );
  return (
    <form action={action} className="grid max-w-[980px] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="start" value={start === "lab" ? "brief" : start} />
      <input type="hidden" name="template" value={tpl} />
      <div className="space-y-5">
        <label className="block text-[13px] text-t-2">
          {p.fTitle}
          <input name="title" required maxLength={80} className={`${field} h-11`} />
        </label>
        <label className="block text-[13px] text-t-2">
          {p.fBrief}
          <textarea name="brief" rows={5} maxLength={4000} placeholder={p.fBriefPh} className={`${field} py-2.5 leading-6`} />
        </label>
        <div>
          <div className="text-[13px] text-t-2">{p.fStart}</div>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
            {opt("template", p.fromTemplate)}
            {opt("brief", p.fromBrief)}
            {opt("lab", p.fromLab)}
          </div>
          {start === "lab" && (
            <a href="/aktar" className="mt-3 inline-flex text-[13px] text-teal-300 hover:text-teal-200">
              {p.fromLab} →
            </a>
          )}
        </div>
        <button className="btn btn-primary h-11">{p.create}</button>
      </div>
      {start === "template" && (
        <div className="grid grid-cols-2 gap-3 self-start">
          {Object.entries(TEMPLATES).map(([k, s]) => (
            <button
              type="button"
              key={k}
              onClick={() => setTpl(k)}
              className={`card overflow-hidden text-left transition-colors ${tpl === k ? "!border-teal-300 shadow-[0_0_30px_-12px_var(--glow-teal)]" : "hover:border-line-3"}`}
            >
              <div className="flex h-28 items-center justify-center bg-g-1 p-4">
                <svg viewBox={`-3 -3 ${s.width + 6} ${s.height + 6}`} className="h-full w-full">
                  <rect width={s.width} height={s.height} rx={s.radius} fill={MASKS[s.finish.mask].three} stroke="#d3c39c" strokeWidth={0.4} />
                  {s.parts.map((pt) => (
                    <circle key={pt.ref} cx={pt.x} cy={pt.y} r={0.9} fill="#d6b46c" />
                  ))}
                </svg>
              </div>
              <div className="border-t border-line-1 px-3 py-2 text-[12.5px] text-t-2">{p.templates[k]}</div>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
