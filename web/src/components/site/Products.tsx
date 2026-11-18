"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { PRODUCTS } from "@/lib/products";
import { L, SectionHead } from "./SectionHead";

const ProductScene = dynamic(() => import("../scenes/ProductScene"), { ssr: false });

/** Little line drawings for the product strip. */
function Thumb({ id }: { id: string }) {
  const s = { fill: "none", stroke: "#d8d4cc", strokeWidth: 1.2 } as const;
  if (id === "air-monitor")
    return (
      <svg viewBox="0 0 40 40" className="h-9 w-9">
        <rect x="6" y="8" width="28" height="24" rx="5" {...s} />
        <rect x="11" y="12" width="18" height="11" rx="1" fill="#d9dcd6" opacity=".8" />
        <circle cx="20" cy="28" r="1" fill="#7ed0dd" />
      </svg>
    );
  if (id === "remote")
    return (
      <svg viewBox="0 0 40 40" className="h-9 w-9">
        <rect x="11" y="5" width="18" height="30" rx="6" {...s} />
        <circle cx="20" cy="23" r="5.5" {...s} />
        <circle cx="20" cy="23" r="6.8" fill="none" stroke="#7ed0dd" strokeWidth="0.8" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9">
      <circle cx="20" cy="20" r="11" {...s} />
      <circle cx="20" cy="20" r="9" fill="none" stroke="#7ed0dd" strokeWidth="0.8" />
      <path d="M20 9V5" {...s} />
    </svg>
  );
}

export function Products() {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const p = PRODUCTS[idx];
  const copy = t.products.items[p.id];

  useEffect(() => {
    if (paused || open) return;
    const id = setTimeout(() => setIdx((i) => (i + 1) % PRODUCTS.length), 9000);
    return () => clearTimeout(id);
  }, [idx, paused, open]);

  const go = (i: number) => {
    setIdx((i + PRODUCTS.length) % PRODUCTS.length);
    setOpen(false);
  };

  return (
    <section id="products" aria-labelledby="products-title" className="relative pt-32">
      <SectionHead
        n={t.products.n}
        id="products-title"
        title={
          <>
            {t.products.t1}
            <br />
            <L>{t.products.t2}</L>
            {t.products.t2b}
          </>
        }
      >
        {t.products.lede}
      </SectionHead>

      <div className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
        {/* strip */}
        <div className="flex items-center gap-4 border-t border-line-1 pt-6">
          <ol className="relative flex flex-1 items-start gap-2 overflow-x-auto sm:gap-10">
            <svg className="pointer-events-none absolute left-0 top-[28px] hidden h-4 w-full sm:block" preserveAspectRatio="none" viewBox="0 0 100 4" aria-hidden>
              <path d="M0 1 H30 l2 2 H62 l2 -2 H100" stroke="var(--line-3)" strokeWidth=".6" fill="none" vectorEffect="non-scaling-stroke" />
              <path d="M0 1 H30 l2 2 H62 l2 -2 H100" stroke="url(#strip)" strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - (idx + 0.5) / PRODUCTS.length} style={{ transition: "stroke-dashoffset .8s var(--ease-out)" }} />
              <defs>
                <linearGradient id="strip">
                  <stop offset="0" stopColor="#7ed0dd" />
                  <stop offset="1" stopColor="#f2c2cf" />
                </linearGradient>
              </defs>
            </svg>
            {PRODUCTS.map((x, i) => (
              <li key={x.id} className="relative shrink-0">
                <button onClick={() => go(i)} className="group flex flex-col items-start gap-2">
                  <span className={`grid h-14 w-[104px] place-items-center rounded-md border bg-g-2 transition-colors ${i === idx ? "border-teal-300 shadow-[0_0_24px_-8px_var(--glow-teal)]" : "border-line-2 group-hover:border-line-3"}`}>
                    <Thumb id={x.id} />
                  </span>
                  <span className="fig">
                    {String(i + 1).padStart(2, "0")} <span className={i === idx ? "text-t-1" : ""}>{t.products.items[x.id].name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="fig mr-2">
              {PRODUCTS.length} {t.products.count}
            </span>
            <button aria-label="pause" onClick={() => setPaused((v) => !v)} className="grid h-8 w-8 place-items-center rounded-md text-t-2 hover:bg-[var(--wash-hover)]">
              {paused ? "▶" : "❚❚"}
            </button>
            <button aria-label="previous" onClick={() => go(idx - 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line-2 text-t-2 hover:text-t-1">
              ‹
            </button>
            <button aria-label="next" onClick={() => go(idx + 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line-2 text-t-2 hover:text-t-1">
              ›
            </button>
          </div>
        </div>

        {/* stage */}
        <div className="relative mt-4 grid min-h-[560px] items-center lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div key={p.id} className="relative z-[2] py-6">
            <span className="inline-flex items-center gap-2 rounded-[3px] border border-teal-line bg-teal-tint px-2 py-1 text-[11.5px] text-t-1">
              <span className="h-[5px] w-[5px] rounded-full bg-teal-300" />
              {t.products.badge}
            </span>
            <h3 className="mt-4 font-display text-[clamp(32px,4vw,44px)] font-semibold tracking-tight">{copy.name}</h3>
            <p className="mt-3 max-w-[26rem] text-lede text-t-2">{copy.line}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {copy.facts.map((f) => (
                <span key={f} className="chip">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="pool relative h-[460px] sm:h-[560px]">
            <ProductScene product={p} open={open} />
            <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost absolute bottom-4 left-1/2 z-[3] -translate-x-1/2 rounded-full bg-g-1/70 backdrop-blur">
              {open ? t.products.close : t.products.pull}
            </button>
          </div>
        </div>
        <div className="flex justify-between border-b border-line-1 pb-4">
          <span className="fig">
            <b>Fig. 2</b> · {copy.name} · {t.products.fig}
          </span>
          <span className="fig hidden sm:inline">{t.products.drag}</span>
        </div>
      </div>
    </section>
  );
}
