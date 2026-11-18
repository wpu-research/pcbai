"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { BOUNDS } from "../scenes/ProcessScene";
import { L, SectionHead } from "./SectionHead";

const ProcessScene = dynamic(() => import("../scenes/ProcessScene"), { ssr: false });


export function Process() {
  const t = useT();
  const STEPS = t.how.steps;
  const track = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const run = r.height - innerHeight;
      progress.current = Math.min(1, Math.max(0, -r.top / Math.max(1, run)));
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    read();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  const jump = (i: number) => {
    const el = track.current;
    if (!el) return;
    const run = el.offsetHeight - innerHeight;
    const top = el.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + run * (BOUNDS[i] + (BOUNDS[i + 1] - BOUNDS[i]) * 0.6), behavior: "smooth" });
  };

  return (
    <section id="how" aria-labelledby="how-title" className="relative pt-28">
      <SectionHead
        n={t.how.n}
        id="how-title"
        title={
          <>
            {t.how.t1}
            <br />
            <L>{t.how.t2a}</L>
            {t.how.t2b}
            <L>{t.how.t2c}</L>
            {t.how.t2d}
          </>
        }
      >
        {t.how.lede}
      </SectionHead>

      <div ref={track} className="relative mt-10" style={{ height: "640vh" }}>
        <div className="sticky top-[72px] h-[calc(100svh-72px)] overflow-hidden">
          <div className="mx-auto grid h-full max-w-[1200px] grid-rows-[auto_1fr] gap-4 px-4 sm:px-6 lg:grid-cols-[320px_1fr] lg:grid-rows-1 lg:gap-10">
            {/* stage list */}
            <ol className="relative z-[2] flex gap-2 overflow-x-auto pt-4 lg:block lg:self-center lg:overflow-visible lg:pt-0">
              {STEPS.map((s, i) => {
                const on = i === stage;
                return (
                  <li key={s.name} className="relative shrink-0 lg:border-b lg:border-line-1">
                    <button onClick={() => jump(i)} className="group flex w-full items-baseline gap-3 py-2.5 text-left">
                      <span className={`mt-1 inline-block h-[6px] w-[6px] shrink-0 self-start rounded-full border transition-colors ${i <= stage ? "border-teal-300 bg-teal-300" : "border-t-4"}`} />
                      <span className="fig w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`font-display text-[19px] font-semibold tracking-tight transition-colors ${on ? "text-t-1" : "text-t-3 group-hover:text-t-2"}`}>{s.name}</span>
                      <span className="fig ml-auto hidden lg:inline">{s.tag}</span>
                    </button>
                    <div className={`hidden overflow-hidden pl-[46px] text-[13.5px] leading-5 text-t-2 transition-[max-height,opacity] duration-500 lg:block ${on ? "max-h-32 pb-3 opacity-100" : "max-h-0 opacity-0"}`}>
                      {s.text}
                    </div>
                    {on && <span className="absolute left-[2px] top-[22px] hidden h-[calc(100%-30px)] w-px bg-gradient-to-b from-teal-300 to-transparent lg:block" />}
                  </li>
                );
              })}
              <li className="mt-6 hidden lg:block">
                <Progress stage={stage} />
              </li>
            </ol>

            {/* 3D */}
            <div className="relative min-h-0">
              <div className="fig absolute right-0 top-4 z-[2] hidden sm:block">
                <b>Fig. 3</b> · {t.how.fig}
              </div>
              <div className="pool absolute inset-0">
                <ProcessScene progress={progress} onStage={setStage} layerNames={t.how.layers} />
              </div>
              <BriefCard show={stage === 0} />
              <div className="absolute bottom-6 left-0 z-[2] flex items-center gap-2 font-mono text-[11px] text-t-2">
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-teal-300 shadow-[0_0_10px_var(--teal-400)]" />
                {STEPS[stage].note}
              </div>
              <p className="absolute bottom-14 left-0 right-0 z-[2] text-[13.5px] text-t-2 lg:hidden">{STEPS[stage].text}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BriefCard({ show }: { show: boolean }) {
  const b = useT().how.briefCard;
  return (
    <div
      className={`card absolute bottom-16 left-0 z-[3] w-[min(330px,90%)] p-3 shadow-[var(--shadow-pop)] transition-all duration-500 sm:left-[12%] ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-line-1 pb-2 text-[13px]">
        <span className="font-mono text-teal-300">›</span> {b.input}
      </div>
      <div className="fig mt-2 flex justify-between">
        <span>{b.spec}</span>
        <span>{b.filled}</span>
      </div>
      <dl className="mt-1.5 grid grid-cols-[96px_1fr] gap-y-1 text-[12px]">
        {b.rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-t-3">{k}</dt>
            <dd className="text-t-1">{v}</dd>
          </div>
        ))}
        <dt className="text-t-3">{b.cert}</dt>
        <dd className="text-t-4">{b.certV}</dd>
      </dl>
    </div>
  );
}

/** Little trace with a node per stage; filled up to the current one. */
function Progress({ stage }: { stage: number }) {
  const xs = [0, 32, 64, 96, 128, 160, 192];
  return (
    <svg viewBox="-4 -8 200 16" className="w-[200px] overflow-visible" aria-hidden>
      <path d="M0 0 H40 l6 5 H86 l6 -5 H140 l6 5 H192" fill="none" stroke="var(--line-3)" strokeWidth="1.4" />
      <path
        d="M0 0 H40 l6 5 H86 l6 -5 H140 l6 5 H192"
        fill="none"
        stroke="url(#pg)"
        strokeWidth="1.6"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - stage / 6}
        style={{ transition: "stroke-dashoffset .6s var(--ease-out)" }}
      />
      <defs>
        <linearGradient id="pg">
          <stop offset="0" stopColor="#7ed0dd" />
          <stop offset="1" stopColor="#f2c2cf" />
        </linearGradient>
      </defs>
      {xs.map((x, i) => (
        <circle key={x} cx={x} cy={(x >= 46 && x <= 86) || x >= 146 ? 5 : 0} r="2.4" fill={i <= stage ? "#7ed0dd" : "#17171a"} stroke={i <= stage ? "#7ed0dd" : "#ffffff29"} />
      ))}
    </svg>
  );
}
