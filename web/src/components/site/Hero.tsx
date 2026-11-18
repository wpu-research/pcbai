"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { BriefInput } from "./BriefInput";

const HeroScene = dynamic(() => import("../scenes/HeroScene"), { ssr: false });

const i = (n: number) => ({ "--i": n }) as React.CSSProperties;

export function Hero() {
  const t = useT();
  const [stage, setStage] = useState(0);
  return (
    <section id="top" className="relative mx-auto grid max-w-[1200px] gap-10 px-4 pt-[124px] sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-6 lg:pt-[150px]">
      <div className="relative z-[2]">
        <div className="enter fig mb-7 flex items-center gap-3" style={i(0)}>
          <span className="h-px w-7 bg-t-4" />
          <span className="tracking-[0.08em] text-t-2">{t.hero.eyebrow}</span>
        </div>
        <h1 className="enter h-display text-[clamp(36px,min(10vw,11svh),70px)] text-t-1" style={i(1)}>
          {t.hero.l1}
          <br />
          <span className="emph emph-line">{t.hero.l2}</span>
          <br />
          {t.hero.l3}
        </h1>
        <p className="enter mt-7 max-w-[34rem] text-lede text-t-2" style={i(2)}>
          {t.hero.lede}
        </p>
        <div className="enter mt-9" style={i(3)}>
          <BriefInput />
          <div className="mt-3 flex max-w-[36rem] items-center justify-between text-[13.5px] text-t-3">
            <span>{t.hero.from}</span>
            <a href="#how" className="text-t-2 hover:text-t-1">
              {t.hero.see}
            </a>
          </div>
        </div>
      </div>

      <figure className="relative">
        <div className="pool relative aspect-[1.15] w-full lg:-mr-10 lg:-mt-6 lg:aspect-[1.08]">
          <HeroScene onStage={setStage} />
        </div>
        <figcaption className="relative z-[2] mt-1 border-t border-line-1 pt-4">
          <div className="fig">
            <b>Fig. 1</b> · {t.hero.fig}
          </div>
          <ol className="fig mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {t.hero.stages.map((s, k) => (
              <li key={s} className={`flex items-center gap-1.5 transition-colors duration-300 ${k < stage ? "text-t-1" : ""}`}>
                <span className={`inline-block h-[6px] w-[6px] rounded-full border ${k < stage ? "border-teal-300 bg-teal-300" : "border-t-4"}`} />
                {s}
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
    </section>
  );
}
