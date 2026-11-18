"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { L, SectionHead } from "./SectionHead";

const PickPlaceScene = dynamic(() => import("../scenes/PickPlaceScene"), { ssr: false });
const ShipScene = dynamic(() => import("../scenes/ShipScene"), { ssr: false });

export function PhaseList({ items, at }: { items: string[]; at: number }) {
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2">
      {items.map((s, i) => (
        <li key={s} className={`fig flex items-center gap-1.5 transition-colors duration-300 ${i === at ? "text-t-1" : i < at ? "text-t-2" : ""}`}>
          <span
            className={`inline-block h-[6px] w-[6px] rounded-full border transition-all ${i === at ? "border-teal-300 bg-teal-300 shadow-[0_0_10px_var(--teal-400)]" : i < at ? "border-teal-300 bg-teal-300/50" : "border-t-4"}`}
          />
          {s}
        </li>
      ))}
    </ol>
  );
}

export function Factory() {
  const t = useT();
  const [line, setLine] = useState(0);
  const [ship, setShip] = useState(0);
  // the tracking strip follows the two animations: line phases map to fabrication/assembly, packing to shipped
  const track = ship >= 4 ? 4 : line >= 5 ? 3 : line >= 2 ? 2 : 1;
  return (
    <section id="factory" aria-labelledby="factory-title" className="relative pt-32">
      <SectionHead
        n={t.factory.n}
        id="factory-title"
        title={
          <>
            {t.factory.t1}
            <br />
            <L>{t.factory.t1b}</L>
          </>
        }
      >
        {t.factory.lede}
      </SectionHead>

      <div className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
        <figure className="card relative overflow-hidden !bg-transparent">
          <div className="pool relative h-[420px] sm:h-[560px]">
            <PickPlaceScene onPhase={setLine} />
          </div>
          <figcaption className="relative z-[2] flex flex-col gap-3 border-t border-line-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <PhaseList items={t.factory.line} at={line} />
            <span className="fig">
              <b>Fig. 4</b> · {t.factory.fig}
            </span>
          </figcaption>
        </figure>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <figure className="card relative overflow-hidden !bg-transparent">
            <div className="pool relative h-[380px]">
              <ShipScene onPhase={setShip} />
            </div>
            <figcaption className="relative z-[2] flex flex-col gap-3 border-t border-line-1 px-4 py-3">
              <PhaseList items={t.factory.ship} at={ship} />
              <span className="fig">
                <b>Fig. 5</b> · {t.factory.shipFig}
              </span>
            </figcaption>
          </figure>

          <div className="flex flex-col gap-6">
            <div className="card p-5">
              <div className="eyebrow">TR 4821 7730 19</div>
              <ol className="relative mt-5 space-y-4 pl-6">
                <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line-2" />
                <span className="absolute left-[5px] top-2 w-px bg-gradient-to-b from-teal-300 to-pink-300 transition-all duration-700" style={{ height: `${(track / (t.factory.track.length - 1)) * 100}%` }} />
                {t.factory.track.map((s, i) => (
                  <li key={s} className="relative flex items-center justify-between text-[13.5px]">
                    <span
                      className={`absolute -left-6 top-1/2 h-[11px] w-[11px] -translate-y-1/2 rounded-full border-2 transition-colors ${i <= track ? "border-teal-300 bg-teal-300" : "border-line-3 bg-g-2"}`}
                    />
                    <span className={i <= track ? "text-t-1" : "text-t-3"}>{s}</span>
                    <span className="fig">{i <= track ? "✓" : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="card relative overflow-hidden p-5">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--glow-teal)] blur-3xl" />
              <h3 className="relative font-display text-[20px] font-semibold tracking-tight">{t.factory.testTitle}</h3>
              <p className="relative mt-2 text-[14px] leading-6 text-t-2">{t.factory.testText}</p>
              <div className="relative mt-4 grid grid-cols-2 gap-2 font-mono text-[11.5px]">
                <div className="rounded-md border border-line-2 bg-g-1 p-2">
                  <div className="fig">sim</div>
                  <div className="text-t-1">T=24.9 H=48</div>
                </div>
                <div className="rounded-md border border-teal-line bg-teal-tint p-2">
                  <div className="fig">board #003</div>
                  <div className="text-teal-200">T=25.1 H=47 ✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
