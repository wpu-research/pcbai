"use client";

import { useT } from "@/lib/i18n";
import { LabSim } from "./LabSim";
import { L, SectionHead } from "./SectionHead";

export const LAB_URL = "https://robotix.macademia.com.tr/laboratuvar";

export function Lab() {
  const t = useT();
  return (
    <section id="lab" aria-labelledby="lab-title" className="relative pt-32">
      <SectionHead
        n={t.lab.n}
        id="lab-title"
        title={
          <>
            {t.lab.t1}
            <br />
            <L>{t.lab.t1b}</L>
          </>
        }
      >
        {t.lab.lede}{" "}
        <a href={LAB_URL} target="_blank" rel="noreferrer" className="text-teal-300 underline decoration-teal-line underline-offset-4 hover:text-teal-200">
          {t.lab.link} ↗
        </a>
      </SectionHead>

      <div className="mx-auto mt-12 grid max-w-[1200px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:items-start">
        <figure>
          <LabSim serialLabel={t.lab.serial} sendLabel={t.lab.send} onSend={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} />
          <figcaption className="fig mt-3">
            <b>Fig. 2b</b> · {t.lab.caption}
          </figcaption>
        </figure>
        <div>
          <h3 className="font-display text-[22px] font-semibold tracking-tight">{t.lab.map}</h3>
          <p className="mt-2 text-[14px] leading-6 text-t-2">{t.lab.mapLede}</p>
          <div className="mt-5 overflow-hidden rounded-lg border border-line-2">
            <div className="fig grid grid-cols-2 border-b border-line-2 bg-g-2 px-3 py-2">
              <span>{t.lab.sim}</span>
              <span>{t.lab.pcb}</span>
            </div>
            {t.lab.rows.map(([a, b]) => (
              <div key={a} className="grid grid-cols-2 gap-3 border-b border-line-1 px-3 py-2.5 text-[13px] last:border-b-0">
                <span className="text-t-2">{a}</span>
                <span className="flex items-start gap-2 text-t-1">
                  <span className="mt-[7px] h-px w-3 shrink-0 bg-teal-300" />
                  {b}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
