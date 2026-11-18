"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DICT } from "@/lib/dict";
import { PRODUCTS } from "@/lib/products";
import HeroScene from "@/components/scenes/HeroScene";
import PickPlaceScene from "@/components/scenes/PickPlaceScene";
import ProcessScene from "@/components/scenes/ProcessScene";
import ProductScene from "@/components/scenes/ProductScene";
import ShipScene from "@/components/scenes/ShipScene";
import TurntableScene from "@/components/scenes/TurntableScene";
import { LabSim } from "@/components/site/LabSim";
import { Logo } from "@/components/site/Logo";
import Stage from "@/components/three/Stage";

const t = DICT.tr;
const LAB = "robotix.macademia.com.tr/laboratuvar";

/* ---------- shared bits ---------- */

function Slide({ n, kicker, title, lede, children, wide = false }: { n: number; kicker: string; title: ReactNode; lede?: ReactNode; children?: ReactNode; wide?: boolean }) {
  return (
    <section data-slide={n} className="relative flex min-h-[100svh] snap-start items-center pb-16 pt-[84px]">
      <div className={`mx-auto grid w-full max-w-[1240px] items-center gap-8 px-5 sm:px-8 ${wide ? "" : "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12"}`}>
        <div className="relative z-[2]">
          <div className="fig flex items-center gap-3">
            <span className="text-pink-300">{String(n).padStart(2, "0")}</span>
            <span className="h-px w-6 bg-t-4" />
            <span className="tracking-[0.08em] text-t-2">{kicker}</span>
          </div>
          <h2 className="h-section mt-4 text-t-1">{title}</h2>
          {lede && <div className="mt-5 max-w-[32rem] text-lede text-t-2">{lede}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

const Em = ({ children }: { children: ReactNode }) => <span className="emph">{children}</span>;

function Phases({ items, at }: { items: string[]; at: number }) {
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2">
      {items.map((s, i) => (
        <li key={s} className={`fig flex items-center gap-1.5 transition-colors duration-300 ${i === at ? "text-t-1" : i < at ? "text-t-2" : ""}`}>
          <span className={`inline-block h-[6px] w-[6px] rounded-full border ${i === at ? "border-teal-300 bg-teal-300 shadow-[0_0_10px_var(--teal-400)]" : i < at ? "border-teal-300 bg-teal-300/50" : "border-t-4"}`} />
          {s}
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: [string, string][] }) {
  return (
    <ul className="mt-7 divide-y divide-line-1 border-y border-line-1">
      {items.map(([a, b]) => (
        <li key={a} className="py-3 text-[14.5px] leading-6">
          <span className="text-t-1">{a}</span> <span className="text-t-3">{b}</span>
        </li>
      ))}
    </ul>
  );
}

/** Visible-only toggle for loops that should not run off-screen. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

/* ---------- diagrams ---------- */

const FLOW = [
  { k: "Simüle et", s: "Sanal laboratuvar" },
  { k: "Tasarla", s: "Ajan PCB'yi çizer" },
  { k: "Gör", s: "3D ve katmanlar" },
  { k: "Sipariş et", s: "Tek tık, net fiyat" },
  { k: "Diz", s: "Pick-and-place hattı" },
  { k: "Test et, gönder", s: "Senin kodunla" },
];

function Pipeline() {
  const [ref, on] = useInView<HTMLDivElement>();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setStep((s) => (s + 1) % (FLOW.length + 2)), 900);
    return () => clearInterval(id);
  }, [on]);
  return (
    <div ref={ref} className="relative">
      <svg viewBox="0 0 600 120" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="flow" x1="0" x2="1">
            <stop offset="0" stopColor="#7ed0dd" />
            <stop offset="1" stopColor="#f2c2cf" />
          </linearGradient>
        </defs>
        <path d="M40 60 H150 l10 16 H250 l10 -16 H350 l10 16 H450 l10 -16 H560" fill="none" stroke="var(--line-3)" strokeWidth="2" />
        <path
          d="M40 60 H150 l10 16 H250 l10 -16 H350 l10 16 H450 l10 -16 H560"
          fill="none"
          stroke="url(#flow)"
          strokeWidth="2.6"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - Math.min(1, step / (FLOW.length - 1))}
          style={{ transition: "stroke-dashoffset .8s var(--ease-out)" }}
        />
        {FLOW.map((_, i) => {
          const x = 40 + i * 104;
          const y = i % 2 ? 76 : 60;
          const lit = i <= step;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="13" fill="#111113" stroke={lit ? "#7ed0dd" : "#ffffff29"} strokeWidth="1.5" style={{ transition: "stroke .3s" }} />
              <circle cx={x} cy={y} r="4.5" fill={lit ? (i === FLOW.length - 1 ? "#f2c2cf" : "#7ed0dd") : "#2a2a2e"} style={{ transition: "fill .3s" }} />
              {i === step && <circle cx={x} cy={y} r="22" fill="#5bbfcd" opacity=".16" />}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
        {FLOW.map((f, i) => (
          <div key={f.k} className={`transition-opacity duration-300 ${i <= step ? "opacity-100" : "opacity-45"}`}>
            <div className="fig">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-1 font-display text-[17px] font-semibold tracking-tight">{f.k}</div>
            <div className="text-[12.5px] text-t-3">{f.s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const LOOP = ["Simülasyon", "Tasarım", "DRC + DFM", "Üretim", "Dizgi", "Test", "Kargo", "Saha verisi"];

function LoopDiagram() {
  const [ref, on] = useInView<HTMLDivElement>();
  const [a, setA] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setA(((now - t0) / 9000) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  const R = 150, C = 200;
  const ang = (i: number) => (i / LOOP.length) * Math.PI * 2 - Math.PI / 2;
  const dot = a * Math.PI * 2 - Math.PI / 2;
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[520px]">
      <svg viewBox="-70 -10 540 420" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="loopg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7ed0dd" />
            <stop offset="1" stopColor="#f2c2cf" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line-2)" strokeWidth="2" />
        <circle cx={C} cy={C} r={R} fill="none" stroke="url(#loopg)" strokeWidth="2.4" strokeDasharray="6 10" style={{ animation: "march 1.2s linear infinite" }} opacity=".7" />
        <circle cx={C} cy={C} r="62" fill="#111113" stroke="var(--line-3)" />
        <text x={C} y={C - 4} textAnchor="middle" fill="#f2f1ee" fontSize="17" fontFamily="var(--font-display)" fontWeight="600">
          Kapalı döngü
        </text>
        <text x={C} y={C + 16} textAnchor="middle" fill="#8a8984" fontSize="10.5" fontFamily="var(--font-mono)">
          kod = test = ürün
        </text>
        {LOOP.map((l, i) => {
          const x = C + Math.cos(ang(i)) * R, y = C + Math.sin(ang(i)) * R;
          const d = Math.abs(((ang(i) - dot + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const lit = d > Math.PI - 0.5;
          return (
            <g key={l}>
              <circle cx={x} cy={y} r="7" fill={lit ? "#7ed0dd" : "#17171a"} stroke={lit ? "#7ed0dd" : "#ffffff3d"} strokeWidth="1.5" />
              <text
                x={C + Math.cos(ang(i)) * (R + 26)}
                y={C + Math.sin(ang(i)) * (R + 26) + 4}
                textAnchor={Math.cos(ang(i)) > 0.3 ? "start" : Math.cos(ang(i)) < -0.3 ? "end" : "middle"}
                fill={lit ? "#f2f1ee" : "#8a8984"}
                fontSize="12.5"
                fontFamily="var(--font-sans)"
              >
                {l}
              </text>
            </g>
          );
        })}
        <circle cx={C + Math.cos(dot) * R} cy={C + Math.sin(dot) * R} r="5" fill="#fff" />
        <circle cx={C + Math.cos(dot) * R} cy={C + Math.sin(dot) * R} r="16" fill="#5bbfcd" opacity=".2" />
      </svg>
    </div>
  );
}

/* ---------- slide-specific widgets ---------- */

function AutoProcess() {
  const progress = useRef(0);
  const [stage, setStage] = useState(0);
  const [ref, on] = useInView<HTMLDivElement>();
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const s = ((now - t0) / 1000) % 19;
      progress.current = Math.min(1, s / 15);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return (
    <div ref={ref}>
      <div className="pool relative h-[min(62svh,560px)]">
        <ProcessScene progress={progress} onStage={setStage} layerNames={t.how.layers} />
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-line-1 pt-3">
        <Phases items={t.how.steps.map((s) => s.name)} at={stage} />
        <p className="text-[13.5px] text-t-2">{t.how.steps[stage].text}</p>
      </div>
    </div>
  );
}

function LayersView() {
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setOpen((v) => !v), 4200);
    return () => clearInterval(id);
  }, [auto]);
  return (
    <div>
      <div className="pool relative h-[min(58svh,520px)]">
        <TurntableScene explode={open ? 1 : 0} distance={open ? 150 : 96} elevation={open ? 18 : 34} />
        <button
          onClick={() => {
            setAuto(false);
            setOpen((v) => !v);
          }}
          className="btn btn-ghost absolute bottom-3 left-1/2 z-[3] -translate-x-1/2 rounded-full bg-g-1/70 backdrop-blur"
        >
          {open ? "Topla" : "Katmanlarına ayır"}
        </button>
      </div>
      <div className="fig mt-3 border-t border-line-1 pt-3">
        <b>Fig.</b> · Lehim maskesi, bakır, fiberglas: siparişten önce her katmanı gör · sürükleyip döndür
      </div>
    </div>
  );
}

const COLORS = [
  ["Siyah", "#1d1f1e"],
  ["Yeşil", "#1e5a40"],
  ["Mavi", "#1e3f70"],
  ["Beyaz", "#e9e8e3"],
];

function OrderPanel() {
  const [qty, setQty] = useState(5);
  const [color, setColor] = useState(0);
  const [sent, setSent] = useState(false);
  const board = 1.9, parts = 7.4, assembly = 3.2, setup = 18;
  const total = setup + qty * (board + parts + assembly);
  return (
    <div className="card p-5 shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between border-b border-line-1 pb-3">
        <div>
          <div className="font-display text-[18px] font-semibold tracking-tight">Wi-Fi iklim düğümü</div>
          <div className="fig">70 × 40 mm · 2 katman · 25 parça · ENIG</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-teal-line bg-teal-tint px-2 py-1 font-mono text-[11px] text-teal-200">✓ DRC + DFM geçti</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <div className="fig mb-1.5">Adet</div>
          <div className="flex h-9 w-fit items-center rounded-md border border-line-3">
            <button className="h-full w-9 text-t-2 hover:text-t-1" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-10 text-center font-mono">{qty}</span>
            <button className="h-full w-9 text-t-2 hover:text-t-1" onClick={() => setQty((q) => Math.min(100, q + 1))}>
              +
            </button>
          </div>
        </div>
        <div>
          <div className="fig mb-1.5">Maske rengi</div>
          <div className="flex gap-2">
            {COLORS.map(([n, c], i) => (
              <button key={n} title={n} onClick={() => setColor(i)} className={`h-8 w-8 rounded-md border-2 ${i === color ? "border-teal-300" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
      <dl className="mt-5 space-y-1.5 border-t border-line-1 pt-4 font-mono text-[12px]">
        {[
          ["Kart üretimi", qty * board],
          ["Parçalar (stokta)", qty * parts],
          ["Dizgi + reflow + AOI", qty * assembly],
          ["Hat hazırlığı, programlama, test", setup],
        ].map(([k, v]) => (
          <div key={k as string} className="flex justify-between">
            <dt className="text-t-3">{k}</dt>
            <dd className="text-t-1">${(v as number).toFixed(2)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-line-1 pt-2 text-[13px]">
          <dt className="text-t-2">Toplam</dt>
          <dd className="text-teal-200">${total.toFixed(2)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between">
        <span className="fig">Tahmini teslim: 8–12 iş günü · örnek fiyatlar</span>
        <button onClick={() => setSent(true)} className="btn btn-primary">
          {sent ? "✓ Hatta gönderildi" : "Sipariş et"}
        </button>
      </div>
    </div>
  );
}

function ProductShow() {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const p = PRODUCTS[i];
  const c = t.products.items[p.id];
  return (
    <div>
      <div className="flex gap-2">
        {PRODUCTS.map((x, k) => (
          <button
            key={x.id}
            onClick={() => {
              setI(k);
              setOpen(false);
            }}
            className={`chip ${k === i ? "!border-teal-300 !text-t-1" : ""}`}
          >
            {t.products.items[x.id].name}
          </button>
        ))}
      </div>
      <div className="pool relative mt-3 h-[min(56svh,500px)]">
        <ProductScene product={p} open={open} />
        <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost absolute bottom-3 left-1/2 z-[3] -translate-x-1/2 rounded-full bg-g-1/70 backdrop-blur">
          {open ? t.products.close : t.products.pull}
        </button>
      </div>
      <p className="mt-3 border-t border-line-1 pt-3 text-[13.5px] text-t-2">{c.line}</p>
    </div>
  );
}

/* ---------- the deck ---------- */

export default function Deck() {
  const [at, setAt] = useState(1);
  const [line, setLine] = useState(0);
  const [ship, setShip] = useState(0);
  const total = 13;

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-slide]")];
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.slide));
      },
      { threshold: 0.55 },
    );
    els.forEach((e) => io.observe(e));
    const go = (d: number) => {
      const cur = Number(document.querySelector<HTMLElement>(`[data-slide="${Math.min(total, Math.max(1, at + d))}"]`)?.dataset.slide);
      document.querySelector(`[data-slide="${cur}"]`)?.scrollIntoView({ behavior: "smooth" });
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") document.querySelector('[data-slide="1"]')?.scrollIntoView({ behavior: "smooth" });
      else if (e.key === "End") document.querySelector(`[data-slide="${total}"]`)?.scrollIntoView({ behavior: "smooth" });
    };
    addEventListener("keydown", key);
    return () => {
      io.disconnect();
      removeEventListener("keydown", key);
    };
  }, [at]);

  return (
    <>
      {/* chrome */}
      <header className="fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-g-1/95 to-g-1/0 backdrop-blur-[2px]">
        <div className="mx-auto flex h-[64px] max-w-[1240px] items-center px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-display text-[17px] font-semibold tracking-tight">
              pcb<span className="text-teal-300">·</span>ai
            </span>
            <span className="fig ml-3 hidden sm:inline">× MacademiaX · Sunum</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="fig">
              <span className="text-t-1">{String(at).padStart(2, "0")}</span> / {total}
            </span>
            <span className="kbd hidden sm:inline-grid">↓</span>
          </div>
        </div>
        <div className="h-px bg-line-1">
          <div className="h-px bg-gradient-to-r from-teal-300 to-pink-300 transition-[width] duration-500" style={{ width: `${(at / total) * 100}%` }} />
        </div>
      </header>

      <main className="relative z-[2]">
        {/* 1 · cover */}
        <section data-slide={1} className="relative flex min-h-[100svh] snap-start items-center pb-10 pt-[84px]">
          <div className="mx-auto grid w-full max-w-[1240px] items-center gap-6 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="relative z-[2]">
              <div className="enter fig mb-7 flex items-center gap-3" style={{ "--i": 0 } as React.CSSProperties}>
                <span className="h-px w-7 bg-t-4" />
                <span className="tracking-[0.08em] text-t-2">Simüle et → Tasarla → Diz → Gönder</span>
              </div>
              <h1 className="enter h-display text-[clamp(38px,6.4vw,76px)]" style={{ "--i": 1 } as React.CSSProperties}>
                Simülasyonda
                <br />
                çalışan devre,
                <br />
                <span className="emph emph-line">kapında kart.</span>
              </h1>
              <p className="enter mt-7 max-w-[32rem] text-lede text-t-2" style={{ "--i": 2 } as React.CSSProperties}>
                MacademiaX sanal laboratuvarında kodla çalıştırdığın devreyi, yapay zekâ PCB&apos;ye çevirir; sipariş verdiğinde kapalı devre hattımız üretir, dizer, test eder ve
                kargolar.
              </p>
              <div className="enter fig mt-8" style={{ "--i": 3 } as React.CSSProperties}>
                Ok tuşları ya da kaydırma ile ilerle · 3D sahneleri sürükleyip döndürebilirsin
              </div>
            </div>
            <div className="pool relative aspect-[1.1] w-full">
              <HeroScene onStage={() => {}} />
            </div>
          </div>
        </section>

        {/* 2 · problem */}
        <Slide
          n={2}
          kicker="Sorun"
          title={
            <>
              Breadboard&apos;da çalışan devre
              <br />
              <Em>ürüne bir türlü dönüşmüyor.</Em>
            </>
          }
          lede="Öğrenci devresini simülatörde ya da masada çalıştırıyor. Ama aynı devreyi gerçek, dizili bir karta çevirmek ayrı bir meslek gerektiriyor."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["01", "PCB aracı öğrenmek", "Şema, footprint, kural, katman: KiCad'e alışmak haftalar sürer."],
              ["02", "Parça bulmak", "Breadboard modülü ≠ üretilebilir çip. Stok, kılıf ve 3D modeli eşleştirmek gerekir."],
              ["03", "Üretim dosyaları", "Gerber, delik, BOM, dizgi koordinatı: bir hata, bütün partiyi çöpe atar."],
              ["04", "Dizgi ve test", "Küçük adet için hat bulmak, programlamak, test etmek, kargolamak dağınık ve pahalı."],
            ].map(([n, a, b]) => (
              <div key={n} className="card p-5">
                <div className="fig text-pink-300">{n}</div>
                <div className="mt-2 font-display text-[19px] font-semibold tracking-tight">{a}</div>
                <p className="mt-1.5 text-[13.5px] leading-5 text-t-2">{b}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 3 · flow */}
        <Slide
          n={3}
          wide
          kicker="Çözüm"
          title={
            <>
              Tek akış: <Em>simülasyondan kapıya.</Em>
            </>
          }
          lede="Her adım bir öncekinin verisini okur. Laboratuvardaki devre ve kod, tasarımın, üretimin ve testin tek kaynağıdır."
        >
          <div className="mt-6">
            <Pipeline />
          </div>
        </Slide>

        {/* 4 · lab */}
        <Slide
          n={4}
          kicker="Adım 1 · Sanal laboratuvar"
          title={
            <>
              Devreyi kur, kodu yaz,
              <br />
              <Em>tarayıcıda çalıştır.</Em>
            </>
          }
          lede={
            <>
              MacademiaX&apos;in sanal Arduino laboratuvarında ({LAB}) devre kurulur ve C++ kodu çalıştırılır: 58 parça, kit gerekmez. Kod istediğini yaptığında tek tıkla PCB
              stüdyosuna gönderilir.
            </>
          }
        >
          <LabSim serialLabel={t.lab.serial} sendLabel={t.lab.send} />
        </Slide>

        {/* 5 · mapping */}
        <Slide
          n={5}
          kicker="Adım 2 · Breadboard'dan karta"
          title={
            <>
              Modüller çipe,
              <br />
              <Em>pinler aynı kalır.</Em>
            </>
          }
          lede="Simülasyondaki her modül, üretilebilir karşılığıyla eşleşir. Kodun kullandığı pin adları korunur; aynı sketch gerçek kartta da çalışır."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
            <div className="overflow-hidden rounded-lg border border-line-2">
              <div className="fig grid grid-cols-2 border-b border-line-2 bg-g-2 px-3 py-2">
                <span>Simülatörde</span>
                <span>Kartta</span>
              </div>
              {t.lab.rows.map(([a, b]) => (
                <div key={a} className="grid grid-cols-2 gap-3 border-b border-line-1 px-3 py-3 text-[13.5px] last:border-b-0">
                  <span className="text-t-2">{a}</span>
                  <span className="flex items-start gap-2 text-t-1">
                    <span className="mt-[9px] h-px w-3 shrink-0 bg-teal-300" />
                    {b}
                  </span>
                </div>
              ))}
            </div>
            <div className="pool relative h-[340px]">
              <TurntableScene distance={104} />
            </div>
          </div>
        </Slide>

        {/* 6 · design */}
        <Slide
          n={6}
          kicker="Adım 3 · PCB tasarımı"
          title={
            <>
              Ajan tasarlar,
              <br />
              <Em>sen izlersin.</Em>
            </>
          }
          lede={
            <>
              Parça seçimi, şema, yerleşim, yol çizimi ve kural denetimi otomatik ilerler. Her aşamada durup bakabilir, istediğini elle değiştirebilirsin.
              <Bullets
                items={[
                  ["Stokta parça", "· sembol, footprint ve 3D modeli eşleşmiş"],
                  ["İşlevsel bloklar", "· güç, radyo, sensör ayrı ayrı"],
                  ["DRC her düzenlemede", "· geçmeyen kart siparişe gitmez"],
                ]}
              />
            </>
          }
        >
          <AutoProcess />
        </Slide>

        {/* 7 · 3D */}
        <Slide
          n={7}
          kicker="Adım 4 · 3D görseller"
          title={
            <>
              Siparişten önce
              <br />
              <Em>her katmanı gör.</Em>
            </>
          }
          lede={
            <>
              Dizili kartın 3D modeli, katmanlarına ayrılmış görünümü ve kasan için STEP dosyası hazır gelir.
              <Bullets
                items={[
                  ["Üretim dosyaları", "· Gerber, delik, BOM, dizgi koordinatı"],
                  ["3D model", "· kasayı kartın etrafına tasarlamak için"],
                  ["KiCad projesi", "· istediğin yerde devam et"],
                ]}
              />
            </>
          }
        >
          <LayersView />
        </Slide>

        {/* 8 · order */}
        <Slide
          n={8}
          kicker="Adım 5 · Sipariş et"
          title={
            <>
              Tek tık,
              <br />
              <Em>net fiyat.</Em>
            </>
          }
          lede="Adet ve maske rengini seç; kart üretimi, parçalar, dizgi ve test kalem kalem görünür. Kart kurallardan geçmeden sipariş düğmesi açılmaz."
        >
          <OrderPanel />
        </Slide>

        {/* 9 · line */}
        <Slide
          n={9}
          wide
          kicker="Adım 6 · Kapalı devre üretim"
          title={
            <>
              Kart üretilir, <Em>dizgi makinesinde dizilir.</Em>
            </>
          }
          lede="Çıplak kart hatta girer, lehim pastası basılır, pick-and-place kafası parçaları makaralardan alıp yerine koyar; reflow fırını ve optik kontrolden geçer."
        >
          <div className="mt-2">
            <div className="card pool relative h-[min(56svh,540px)] overflow-hidden !bg-transparent">
              <PickPlaceScene onPhase={setLine} />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Phases items={t.factory.line} at={line} />
              <span className="fig">Canlı simülasyon · sürükleyip döndür</span>
            </div>
          </div>
        </Slide>

        {/* 10 · test + ship */}
        <Slide
          n={10}
          kicker="Adım 7 · Test ve kargo"
          title={
            <>
              Senin kodunla test,
              <br />
              <Em>kapına kargo.</Em>
            </>
          }
          lede={
            <>
              Simülatörde çalıştırdığın kod karta yüklenir; gerçek sensör okumaları simülasyonla karşılaştırılır. Geçen kartlar antistatik poşetle paketlenir ve takip numarasıyla
              yola çıkar.
              <div className="mt-6 grid grid-cols-2 gap-2 font-mono text-[12px]">
                <div className="rounded-md border border-line-2 bg-g-1 p-2.5">
                  <div className="fig">simülasyon</div>
                  <div className="text-t-1">T=24.9 H=48</div>
                </div>
                <div className="rounded-md border border-teal-line bg-teal-tint p-2.5">
                  <div className="fig">kart #003</div>
                  <div className="text-teal-200">T=25.1 H=47 ✓</div>
                </div>
              </div>
            </>
          }
        >
          <div>
            <div className="card pool relative h-[min(50svh,440px)] overflow-hidden !bg-transparent">
              <ShipScene onPhase={setShip} />
            </div>
            <div className="mt-3">
              <Phases items={t.factory.ship} at={ship} />
            </div>
          </div>
        </Slide>

        {/* 11 · loop */}
        <Slide
          n={11}
          kicker="Neden kapalı döngü"
          title={
            <>
              Kod, test ve ürün
              <br />
              <Em>aynı kaynaktan.</Em>
            </>
          }
          lede={
            <>
              Simülasyon yalnızca öğrenme aracı değil, üretim hattının test şartnamesidir. Sahadaki cihazın verisi de laboratuvara geri döner.
              <Bullets
                items={[
                  ["Hata erken yakalanır", "· simülasyonda geçmeyen devre tasarıma girmez"],
                  ["Test otomatik yazılır", "· beklenen değerler simülasyondan gelir"],
                  ["Öğrenme ürünle biter", "· ders projesi gerçek bir cihaza dönüşür"],
                ]}
              />
            </>
          }
        >
          <LoopDiagram />
        </Slide>

        {/* 12 · products */}
        <Slide
          n={12}
          kicker="Aynı akıştan çıkanlar"
          title={
            <>
              Bir cümleden
              <br />
              <Em>bir cihaza.</Em>
            </>
          }
          lede="Konsept ürünler: kartlar ajan tarafından tasarlandı, kasalar kartın etrafına modellendi. Parçalarına ayırıp içini gör."
        >
          <ProductShow />
        </Slide>

        {/* 13 · close */}
        <section data-slide={13} className="relative flex min-h-[100svh] snap-start items-center pb-16 pt-[84px]">
          <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
            <div className="fig flex items-center gap-3">
              <span className="text-pink-300">13</span>
              <span className="h-px w-6 bg-t-4" />
              <span className="tracking-[0.08em] text-t-2">Sonraki adımlar</span>
            </div>
            <h2 className="h-display mt-5 text-[clamp(36px,6vw,72px)]">
              Öğrenciden <span className="emph emph-line">üreticiye.</span>
            </h2>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                ["1", "Pilot", "Laboratuvardan tek tıkla dışa aktarma ve referans kartla ilk 10 öğrenci projesi."],
                ["2", "Hat ortaklığı", "Kart üretimi ve dizgi için ortak hat; programlama ve test istasyonu bizde."],
                ["3", "Yaygınlaştırma", "Okul ve laboratuvar paketleri; sınıfın projeleri toplu siparişle tek kutuda."],
              ].map(([n, a, b]) => (
                <div key={n} className="card p-6">
                  <div className="font-mono text-[28px] font-light text-t-3">{n}</div>
                  <div className="mt-3 font-display text-[21px] font-semibold tracking-tight">{a}</div>
                  <p className="mt-2 text-[14px] leading-6 text-t-2">{b}</p>
                </div>
              ))}
            </div>
            <div className="fig mt-12">pcbai × MacademiaX · {LAB} · Footprint ve 3D modeller: KiCad kütüphaneleri, CC-BY-SA 4.0</div>
          </div>
        </section>
      </main>
      <Stage />
    </>
  );
}
