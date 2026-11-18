"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { BriefInput } from "./BriefInput";
import { LAB_URL } from "./Lab";
import { Logo } from "./Logo";
import { L, SectionHead } from "./SectionHead";

const TurntableScene = dynamic(() => import("../scenes/TurntableScene"), { ssr: false });

export function Outputs() {
  const t = useT();
  return (
    <section id="outputs" aria-labelledby="outputs-title" className="relative pt-32">
      <SectionHead
        n={t.outputs.n}
        id="outputs-title"
        title={
          <>
            {t.outputs.t1}
            <br />
            <L>{t.outputs.t1b}</L>
          </>
        }
      >
        {t.outputs.lede}
      </SectionHead>
      <div className="mx-auto mt-12 grid max-w-[1200px] gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <ul className="divide-y divide-line-1 border-y border-line-1">
          {t.outputs.items.map(([a, b]) => (
            <li key={a} className="py-5 text-[16px]">
              <span className="text-t-1">{a}</span>
              <span className="text-t-3">{b}</span>
            </li>
          ))}
        </ul>
        <figure>
          <div className="card pool relative h-[380px] overflow-hidden !bg-transparent">
            <TurntableScene />
          </div>
          <figcaption className="fig mt-3">
            <b>Fig. 6</b> · {t.outputs.fig}
          </figcaption>
        </figure>
      </div>
      <div className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
        <div className="eyebrow mb-4">{t.outputs.also}</div>
        <div className="grid gap-6 sm:grid-cols-3">
          {t.outputs.more.map(([a, b]) => (
            <p key={a} className="text-[14px] leading-6">
              <span className="text-t-1">{a}</span>
              <span className="text-t-3">{b}</span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const t = useT();
  const [annual, setAnnual] = useState(false);
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="relative pt-32">
      <SectionHead
        n={t.pricing.n}
        id="pricing-title"
        title={
          <>
            {t.pricing.t1}
            <br />
            {t.pricing.t2}
            <L>{t.pricing.t2b}</L>
          </>
        }
      >
        {t.pricing.lede}
      </SectionHead>
      <div className="mx-auto mt-10 max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto mb-8 flex w-fit items-center gap-1 rounded-full border border-line-2 p-1 text-[13px]">
          <button onClick={() => setAnnual(false)} className={`rounded-full px-3 py-1 ${!annual ? "bg-g-4 text-t-1" : "text-t-3"}`}>
            {t.pricing.monthly}
          </button>
          <button onClick={() => setAnnual(true)} className={`flex items-center gap-2 rounded-full px-3 py-1 ${annual ? "bg-g-4 text-t-1" : "text-t-3"}`}>
            {t.pricing.annual}
            <span className="rounded-[3px] bg-teal-tint px-1.5 font-mono text-[10.5px] text-teal-300">{t.pricing.free}</span>
          </button>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {t.pricing.plans.map((p, i) => {
            const rec = i === 1;
            const price = annual ? Math.round((p.price * 10) / 12) : p.price;
            return (
              <div key={p.name} className={`card relative flex flex-col p-6 ${rec ? "border-teal-line shadow-[0_0_60px_-24px_var(--glow-teal)]" : ""}`}>
                {rec && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-t-1 px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-g-1">{t.pricing.rec}</span>}
                <h3 className="font-display text-[22px] font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-1 text-[13.5px] text-t-3">{p.for}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-[18px] text-t-2">$</span>
                  <span className="font-display text-[44px] font-semibold leading-none tracking-tight">{price}</span>
                  <span className="ml-1 text-[13px] text-t-3">{t.pricing.per}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5 text-[13.5px] text-t-2">
                  {p.feats.map((f, k) => (
                    <li key={f} className="flex gap-2.5">
                      {k === 0 && i > 0 ? <span className="w-3.5" /> : <span className="text-teal-300">✓</span>}
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="/kayit" className={`btn mt-7 justify-center ${rec ? "btn-primary" : "btn-ghost"}`}>
                  {p.cta}
                </a>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-[12.5px] text-t-3">{t.pricing.note}</p>
      </div>
    </section>
  );
}

export function Faq() {
  const t = useT();
  return (
    <section id="faq" aria-labelledby="faq-title" className="relative pt-32">
      <SectionHead
        n={t.faq.n}
        id="faq-title"
        title={
          <>
            {t.faq.t1}
            <L>{t.faq.t1b}</L>
          </>
        }
      >
        {t.faq.lede}
      </SectionHead>
      <dl className="mx-auto mt-10 max-w-[1200px] divide-y divide-line-1 border-y border-line-1 px-4 sm:px-6">
        {t.faq.items.map(([q, a]) => (
          <div key={q} className="grid gap-2 py-6 md:grid-cols-[1fr_1.4fr] md:gap-10">
            <dt className="text-[16px] text-t-1">{q}</dt>
            <dd className="text-[14.5px] leading-6 text-t-2">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Cta() {
  const t = useT();
  return (
    <section id="start" className="relative mx-auto max-w-[1200px] px-4 pb-24 pt-36 sm:px-6">
      <h2 className="h-display text-[clamp(34px,8vw,72px)]">
        {t.cta.t1}
        <span className="emph emph-line">{t.cta.t1b}</span>
        {t.cta.t1c}
      </h2>
      <p className="mt-5 text-lede text-t-2">{t.cta.lede}</p>
      <div className="mt-8">
        <BriefInput />
      </div>
      <a href="#top" className="mt-4 inline-block text-[13.5px] text-t-2 hover:text-t-1">
        {t.cta.example}
      </a>
    </section>
  );
}

export function Footer() {
  const t = useT();
  const col = (title: string, links: [string, string][]) => (
    <div>
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-4 space-y-2 text-[13.5px] text-t-2">
        {links.map(([l, h]) => (
          <li key={l}>
            <a href={h} className="hover:text-t-1">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="relative z-[2] border-t border-line-1">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1fr_1fr_1fr_2fr]">
        {col(t.footer.product, [
          [t.nav.how, "#how"],
          [t.nav.factory, "#factory"],
          [t.nav.pricing, "#pricing"],
        ])}
        {col(t.footer.learn, [
          [t.footer.lab, LAB_URL],
          [t.footer.deck, "/sunum.html"],
        ])}
        {col(t.footer.legal, [
          [t.footer.terms, "#"],
          [t.footer.privacy, "#"],
        ])}
        {col(t.footer.follow, [
          ["Instagram", "#"],
          ["YouTube", "#"],
        ])}
        <div className="grid grid-cols-[auto_1fr] gap-4 rounded-lg border border-line-2 p-4">
          <Logo className="h-12 w-12" />
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="col-span-2">
              <div className="eyebrow !text-[10px]">{BRAND.domain}</div>
              <p className="mt-1 text-t-2">{t.footer.desc}</p>
            </div>
            <div>
              <div className="eyebrow !text-[10px]">{t.footer.licence}</div>
              <p className="mt-1 font-mono text-[10.5px] text-t-3">{t.footer.licenceV}</p>
            </div>
            <div>
              <div className="eyebrow !text-[10px]">©</div>
              <p className="mt-1 font-mono text-[10.5px] text-t-3">2026 {BRAND.name}</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
