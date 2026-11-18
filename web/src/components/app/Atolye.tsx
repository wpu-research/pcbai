"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { encodeLabFragment, type LabExport } from "@/lib/lab/import";
import { pinsOf, type DesignLike } from "@/lib/atolye/to-lab";

type Design = DesignLike & { summary: string; steps: string[] };
type Msg = { role: "user"; text: string } | { role: "assistant"; design: Design; lab: LabExport } | { role: "error"; text: string };

const LAB_URL = process.env.NEXT_PUBLIC_LAB_URL || "https://robotix.macademia.com.tr/laboratuvar";
const KEEP = "pcbai.atolye";

const T = {
  tr: {
    title: "Devre Atölyesi",
    lede: "Yapmak istediğin projeyi yaz. Arduino devresini ve kodunu sanal laboratuvarda çalışacak şekilde tasarlarım; sonra tek tıkla karta dönüştürürsün.",
    placeholder: "ör. Toprak kuruyunca pompayı çalıştıran, nemi OLED ekranda gösteren bir saksı sulayıcı",
    send: "Tasarla",
    thinking: "Devre ve kod tasarlanıyor…",
    examples: ["Mesafe sensörlü park asistanı: yaklaştıkça buzzer hızlansın", "Sıcaklık ve nemi LCD ekranda gösteren hava istasyonu", "Butonla yönü değişen servo motorlu kapı", "Gaz algılayınca alarm çalan ve LED yakan dedektör"],
    parts: "Parçalar",
    wiring: "Bağlantılar",
    code: "Kod",
    steps: "Laboratuvarda dene",
    toPcb: "PCB'ye dönüştür",
    openLab: "Laboratuvarda aç",
    copy: "Kopyala",
    copied: "Kopyalandı",
    download: ".ino indir",
    json: "Devre (JSON)",
    refine: "Geliştir: ör. bir de LED ekle",
    clear: "Yeni proje",
    errors: { "not-configured": "Yapay zekâ henüz yapılandırılmadı.", limited: "Saatlik tasarım sınırına ulaştın; biraz sonra tekrar dene.", busy: "Yoğunluk var, birkaç saniye sonra tekrar dene.", refused: "Bu isteği tasarlayamıyorum; projeyi farklı anlatmayı dene.", invalid: "Geçerli bir devre üretilemedi; isteği biraz daha açık yaz.", incomplete: "Yanıt tamamlanamadı; tekrar dene.", auth: "Oturumun kapanmış; tekrar giriş yap.", "too-long": "Mesaj çok uzun.", default: "Bir sorun oldu; tekrar dene." } as Record<string, string>,
  },
  en: {
    title: "Circuit Workshop",
    lede: "Describe the project you want. I design the Arduino circuit and code so they run in the virtual lab; then turn it into a board in one click.",
    placeholder: "e.g. A plant waterer that runs a pump when the soil is dry and shows moisture on an OLED",
    send: "Design",
    thinking: "Designing the circuit and code…",
    examples: ["Parking assistant: the buzzer speeds up as you get closer", "Weather station showing temperature and humidity on an LCD", "Servo door that changes direction with a button", "Gas detector with an alarm and a warning LED"],
    parts: "Parts",
    wiring: "Wiring",
    code: "Code",
    steps: "Try it in the lab",
    toPcb: "Turn into a PCB",
    openLab: "Open in the lab",
    copy: "Copy",
    copied: "Copied",
    download: "Download .ino",
    json: "Circuit (JSON)",
    refine: "Refine: e.g. add an LED too",
    clear: "New project",
    errors: { "not-configured": "The assistant is not configured yet.", limited: "You reached the hourly design limit; try again later.", busy: "Busy right now; try again in a few seconds.", refused: "I can't design this request; try describing it differently.", invalid: "Couldn't produce a valid circuit; describe the idea a bit more.", incomplete: "The answer was cut short; try again.", auth: "Your session ended; sign in again.", "too-long": "The message is too long.", default: "Something went wrong; try again." } as Record<string, string>,
  },
};

/** Uno on the left with the pins in use, each part on the right with its pins, a line per wire. */
function WiringDiagram({ d }: { d: Design }) {
  const uno = d.parts.find((p) => p.type === "uno");
  const others = d.parts.filter((p) => p.type !== "uno");
  const unoPins = pinsOf("uno").filter((pin) => d.wires.some((w) => (w.from.part === uno?.id && w.from.pin === pin) || (w.to.part === uno?.id && w.to.pin === pin)));
  const ROW = 22, PW = 150;
  const used = (id: string) => pinsOf(d.parts.find((p) => p.id === id)!.type).filter((pin) => d.wires.some((w) => (w.from.part === id && w.from.pin === pin) || (w.to.part === id && w.to.pin === pin)));
  let y = 10;
  const boxes = others.map((p) => {
    const pins = used(p.id);
    const b = { p, pins, y, h: Math.max(1, pins.length) * ROW + 30 };
    y += b.h + 14;
    return b;
  });
  const H = Math.max(unoPins.length * ROW + 50, y);
  const pinY = new Map<string, number>();
  unoPins.forEach((pin, i) => pinY.set(`${uno?.id}:${pin}`, 40 + i * ROW));
  boxes.forEach((b) => b.pins.forEach((pin, i) => pinY.set(`${b.p.id}:${pin}`, b.y + 30 + i * ROW)));
  const xOf = (part: string) => (part === uno?.id ? 140 : 560);
  const colors = ["#7ed0dd", "#f2c2cf", "#e9cc71", "#88ce97", "#9bb8e8", "#eda66e"];
  return (
    <svg viewBox={`0 0 ${560 + PW + 10} ${H}`} className="w-full" style={{ maxHeight: 520 }}>
      <rect x={10} y={10} width={130} height={unoPins.length * ROW + 40} rx={8} fill="#0f6d80" />
      <text x={75} y={30} textAnchor="middle" fill="#e8f6f8" fontSize={13} fontWeight={600} fontFamily="sans-serif">Arduino Uno</text>
      {unoPins.map((pin, i) => (
        <text key={pin} x={132} y={44 + i * ROW} textAnchor="end" fill="#e8f6f8" fontSize={11} fontFamily="monospace">{pin}</text>
      ))}
      {d.wires.map((w, i) => {
        const a = pinY.get(`${w.from.part}:${w.from.pin}`), b = pinY.get(`${w.to.part}:${w.to.pin}`);
        if (a === undefined || b === undefined) return null;
        const x1 = xOf(w.from.part), x2 = xOf(w.to.part);
        const gnd = /GND|^-$/.test(w.from.pin) || /GND|^-$/.test(w.to.pin);
        const col = gnd ? "#5c5b57" : colors[i % colors.length];
        if (x1 === x2) return <path key={i} d={`M${x1} ${a} C${x1 - 40} ${a} ${x1 - 40} ${b} ${x1} ${b}`} fill="none" stroke={col} strokeWidth={1.6} />;
        return <path key={i} d={`M${x1} ${a} C${(x1 + x2) / 2} ${a} ${(x1 + x2) / 2} ${b} ${x2} ${b}`} fill="none" stroke={col} strokeWidth={1.6} opacity={gnd ? 0.6 : 0.95} />;
      })}
      {boxes.map((b) => (
        <g key={b.p.id}>
          <rect x={560} y={b.y} width={PW} height={b.h} rx={6} fill="#17171a" stroke="#ffffff29" />
          <text x={570} y={b.y + 18} fill="#f2f1ee" fontSize={12} fontWeight={600} fontFamily="sans-serif">{b.p.type}</text>
          <text x={700} y={b.y + 18} textAnchor="end" fill="#8a8984" fontSize={10} fontFamily="monospace">{b.p.id}</text>
          {b.pins.map((pin, i) => (
            <g key={pin}>
              <circle cx={560} cy={b.y + 30 + i * ROW - 4} r={3} fill="#d6b46c" />
              <text x={570} y={b.y + 30 + i * ROW} fill="#b5b4b0" fontSize={11} fontFamily="monospace">{pin}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

function DesignCard({ d, lab, t }: { d: Design; lab: LabExport; t: (typeof T)["tr"] }) {
  const [copied, setCopied] = useState(false);
  const frag = encodeLabFragment(lab);
  const download = (name: string, text: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const slug = d.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "proje";
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line-1 p-5">
        <h3 className="font-display text-[22px] font-semibold tracking-tight">{d.title}</h3>
        <p className="mt-2 text-[14px] leading-6 text-t-2">{d.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/aktar#${frag}`} className="btn btn-primary">{t.toPcb} →</a>
          <a href={`${LAB_URL}#pcbai=${frag}`} target="_blank" rel="noreferrer" className="btn btn-ghost">{t.openLab} ↗</a>
          <button onClick={() => download(`${slug}.ino`, d.code, "text/plain")} className="btn btn-ghost">{t.download}</button>
          <button onClick={() => download(`${slug}.json`, JSON.stringify(lab, null, 2), "application/json")} className="btn btn-ghost">{t.json}</button>
        </div>
      </div>
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5 border-b border-line-1 p-5 xl:border-b-0 xl:border-r">
          <div>
            <div className="eyebrow mb-2">{t.parts}</div>
            <ul className="space-y-1.5 text-[13.5px]">
              {d.parts.map((p) => (
                <li key={p.id} className="flex gap-3">
                  <span className="w-20 shrink-0 font-mono text-[12px] text-teal-300">{p.type}</span>
                  <span className="text-t-2">{p.label}{p.props.length ? <span className="text-t-4"> · {p.props.map((kv) => `${kv.key}=${kv.value}`).join(", ")}</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-2">{t.wiring}</div>
            <div className="rounded-md border border-line-2 bg-g-1 p-2"><WiringDiagram d={d} /></div>
          </div>
          {d.steps.length > 0 && (
            <div>
              <div className="eyebrow mb-2">{t.steps}</div>
              <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-t-2">{d.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="eyebrow">{t.code}</div>
            <button onClick={() => { navigator.clipboard.writeText(d.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-[12px] text-t-3 hover:text-t-1">{copied ? `✓ ${t.copied}` : t.copy}</button>
          </div>
          <pre className="max-h-[560px] overflow-auto rounded-md border border-line-2 bg-g-0 p-3 font-mono text-[12px] leading-[18px] text-t-2">{d.code}</pre>
        </div>
      </div>
    </div>
  );
}

export function Atolye() {
  const { lang } = useI18n();
  const t = T[lang];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const kept = JSON.parse(sessionStorage.getItem(KEEP) ?? "[]");
      if (Array.isArray(kept)) setMsgs(kept);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEEP, JSON.stringify(msgs.slice(-12)));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const send = async (prompt: string) => {
    const q = prompt.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: q }];
    setMsgs(next);
    setText("");
    setBusy(true);
    // the assistant sees earlier designs as its own JSON answers, so refinements build on them
    const history = next.flatMap((m) => (m.role === "user" ? [{ role: "user", content: m.text }] : m.role === "assistant" ? [{ role: "assistant", content: JSON.stringify(m.design) }] : []));
    try {
      const res = await fetch("/api/atolye", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.design) setMsgs((m) => [...m, { role: "assistant", design: body.design, lab: body.lab }]);
      else setMsgs((m) => [...m, { role: "error", text: t.errors[body.error] ?? t.errors.default }]);
    } catch {
      setMsgs((m) => [...m, { role: "error", text: t.errors.default }]);
    } finally {
      setBusy(false);
    }
  };

  const hasDesign = msgs.some((m) => m.role === "assistant");
  return (
    <div className="relative pb-48">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">{t.title}</h1>
          <p className="mt-1.5 max-w-[46rem] text-[14px] text-t-2">{t.lede}</p>
        </div>
        {msgs.length > 0 && <button onClick={() => setMsgs([])} className="btn btn-ghost">{t.clear}</button>}
      </div>

      {msgs.length === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {t.examples.map((e) => (
            <button key={e} onClick={() => send(e)} className="card p-4 text-left text-[14px] text-t-2 transition-colors hover:border-teal-line hover:text-t-1">
              <span className="mr-2 font-mono text-teal-300">›</span>{e}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[680px] rounded-xl rounded-br-sm border border-line-2 bg-g-3 px-4 py-3 text-[14.5px]">{m.text}</div>
          ) : m.role === "assistant" ? (
            <DesignCard key={i} d={m.design} lab={m.lab} t={t} />
          ) : (
            <div key={i} className="rounded-md border border-[#f08a7e55] bg-[#f08a7e14] px-4 py-3 text-[13.5px] text-crit">{m.text}</div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-3 text-[14px] text-t-2">
            <span className="h-2 w-2 rounded-full bg-teal-300" style={{ animation: "pulse-dot 1s infinite" }} />
            {t.thinking}
          </div>
        )}
        <div ref={end} />
      </div>

      {/* chat box, pinned under everything */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-line-1 bg-g-1/95 px-4 py-4 backdrop-blur lg:left-[232px] sm:px-8"
      >
        <div className="mx-auto flex max-w-[1100px] items-end gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={hasDesign ? t.refine : t.placeholder}
            className="min-h-[52px] flex-1 resize-none rounded-lg border border-line-3 bg-g-1 px-4 py-3 text-[14.5px] text-t-1 outline-none focus:border-teal-400 focus:shadow-[0_0_0_4px_#5bbfcd1f]"
          />
          <button disabled={busy || !text.trim()} className="btn btn-primary h-[52px] px-6 disabled:opacity-50">{t.send}</button>
        </div>
      </form>
    </div>
  );
}
