"use client";

import { useEffect, useRef, useState } from "react";

const SKETCH = `#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;
const int LED = 7;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  bme.begin(0x76);
}

void loop() {
  float t = bme.readTemperature();
  float h = bme.readHumidity();
  Serial.print("T="); Serial.print(t, 1);
  Serial.print(" H="); Serial.println(h, 0);
  digitalWrite(LED, t > 26 ? HIGH : LOW);
  delay(1000);
}`;

const KW = /\b(void|float|const|int|return|if|else|HIGH|LOW|OUTPUT)\b/g;

function highlight(line: string) {
  if (line.startsWith("#")) return <span className="text-pink-300">{line}</span>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  line.replace(/"[^"]*"|\b\d+(\.\d+)?\b|0x[0-9a-f]+|\b(void|float|const|int|return|if|else|HIGH|LOW|OUTPUT)\b/gi, (m, _a, _b, off: number) => {
    parts.push(line.slice(last, off));
    const cls = m.startsWith('"') ? "text-ok" : KW.test(m) ? "text-teal-300" : "text-[var(--warn)]";
    KW.lastIndex = 0;
    parts.push(
      <span key={off} className={cls}>
        {m}
      </span>,
    );
    last = off + m.length;
    return m;
  });
  parts.push(line.slice(last));
  return parts;
}

/** A stylised stand-in for the MacademiaX virtual lab: code, circuit, serial monitor. */
export function LabSim({ serialLabel, sendLabel, onSend }: { serialLabel: string; sendLabel: string; onSend?: () => void }) {
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const [led, setLed] = useState(false);
  const temp = useRef(24.8);
  const root = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: "0px 0px -20% 0px" });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live) return;
    if (typed < SKETCH.length) {
      const id = setTimeout(() => setTyped((n) => Math.min(SKETCH.length, n + 6)), 16);
      return () => clearTimeout(id);
    }
    const id = setInterval(() => {
      temp.current += (Math.random() - 0.35) * 0.6;
      if (temp.current > 27.6) temp.current = 24.6;
      const t = temp.current, h = 48 + Math.round(Math.sin(Date.now() / 4000) * 3);
      setLed(t > 26);
      setLines((l) => [...l.slice(-5), `T=${t.toFixed(1)} H=${h}`]);
    }, 1000);
    return () => clearInterval(id);
  }, [live, typed]);

  const code = SKETCH.slice(0, typed).split("\n");

  return (
    <div ref={root} className="card overflow-hidden shadow-[var(--shadow-pop)]">
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-line-1 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-g-4" />
        <span className="h-2.5 w-2.5 rounded-full bg-g-4" />
        <span className="h-2.5 w-2.5 rounded-full bg-g-4" />
        <span className="fig ml-2">robotix.macademia.com.tr/laboratuvar</span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-ok">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" style={{ animation: "pulse-dot 1.4s infinite" }} /> RUN
        </span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* code */}
        <pre className="h-[340px] overflow-hidden border-b border-line-1 bg-g-1 p-4 font-mono text-[11.5px] leading-[17px] text-t-2 md:border-b-0 md:border-r">
          {code.map((l, i) => (
            <div key={i} className="flex">
              <span className="mr-3 w-5 shrink-0 text-right text-t-4">{i + 1}</span>
              <span className="whitespace-pre">{highlight(l)}</span>
            </div>
          ))}
          {typed < SKETCH.length && <span className="ml-8 inline-block h-3.5 w-1.5 translate-y-0.5 bg-teal-300" />}
        </pre>

        {/* circuit */}
        <div className="relative bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:14px_14px]">
          <svg viewBox="0 0 420 300" className="h-[340px] w-full" aria-hidden>
            {/* breadboard */}
            <rect x="230" y="40" width="170" height="210" rx="6" fill="#e9e6dd" />
            <rect x="230" y="141" width="170" height="8" fill="#d6d2c6" />
            {Array.from({ length: 14 }).map((_, r) =>
              Array.from({ length: 10 }).map((__, c) => (
                <rect key={`${r}-${c}`} x={244 + c * 15} y={52 + r * 14 + (r >= 7 ? 12 : 0)} width="4" height="4" rx="1" fill="#a9a496" />
              )),
            )}
            {/* BME280 breakout */}
            <rect x="262" y="58" width="58" height="44" rx="3" fill="#5b2d82" />
            <rect x="285" y="72" width="12" height="12" rx="1" fill="#c9cdd2" />
            <circle cx="291" cy="78" r="1.6" fill="#333" />
            <text x="291" y="96" textAnchor="middle" fontSize="7" fill="#efe9ff" fontFamily="monospace">BME280</text>
            {/* LED + resistor */}
            <rect x="338" y="198" width="26" height="7" rx="2" fill="#c8a165" />
            <rect x="344" y="198" width="2" height="7" fill="#7a3d2a" />
            <rect x="350" y="198" width="2" height="7" fill="#222" />
            <rect x="356" y="198" width="2" height="7" fill="#7a3d2a" />
            <circle cx="300" cy="200" r="9" fill={led ? "#ff4a3d" : "#5a1612"} style={{ transition: "fill .15s" }} />
            {led && <circle cx="300" cy="200" r="22" fill="#ff4a3d" opacity=".22" />}
            {/* Arduino Uno */}
            <g>
              <rect x="20" y="70" width="170" height="124" rx="8" fill="#0f6d80" />
              <rect x="6" y="88" width="30" height="26" rx="2" fill="#bfc4c9" />
              <rect x="10" y="150" width="22" height="30" rx="2" fill="#1d1f22" />
              <rect x="70" y="128" width="78" height="20" rx="2" fill="#1b1d20" />
              {Array.from({ length: 14 }).map((_, i) => (
                <rect key={i} x={72 + i * 8} y="74" width="5" height="6" fill="#111" />
              ))}
              {Array.from({ length: 12 }).map((_, i) => (
                <rect key={i} x={84 + i * 8} y="184" width="5" height="6" fill="#111" />
              ))}
              <text x="105" y="118" textAnchor="middle" fontSize="13" fill="#e8f6f8" fontFamily="sans-serif" fontWeight="600">UNO</text>
              <circle cx="166" cy="102" r="3" fill={led ? "#ffd27a" : "#3b3a2a"} />
            </g>
            {/* wires (marching = data) */}
            <g fill="none" strokeWidth="2.4" strokeLinecap="round">
              <path d="M101 74 C101 30 270 30 270 58" stroke="#e85d5d" />
              <path d="M109 74 C109 38 282 40 282 58" stroke="#2a2a2a" />
              <path d="M180 184 C200 230 250 120 300 104" stroke="#5bbfcd" strokeDasharray="5 3" style={{ animation: "march .8s linear infinite" }} />
              <path d="M172 184 C190 240 262 130 312 104" stroke="#f2c2cf" strokeDasharray="5 3" style={{ animation: "march .8s linear infinite" }} />
              <path d="M124 74 C124 20 400 10 364 198" stroke="#e9cc71" />
            </g>
          </svg>
          {/* serial monitor */}
          <div className="absolute bottom-3 left-3 right-3 rounded-md border border-line-2 bg-g-0/90 p-2 font-mono text-[11px] leading-4 backdrop-blur">
            <div className="fig mb-1 flex justify-between">
              <span>{serialLabel}</span>
              <span>115200 baud</span>
            </div>
            <div className="h-[48px] overflow-hidden text-ok">
              {lines.slice(-3).map((l, i) => (
                <div key={i + l}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line-1 px-3 py-2">
        <span className="fig">sketch.ino · Arduino Uno · BME280 · LED D7</span>
        <button onClick={onSend} className="btn btn-primary h-8 text-[12.5px]">
          {sendLabel} →
        </button>
      </div>
    </div>
  );
}
