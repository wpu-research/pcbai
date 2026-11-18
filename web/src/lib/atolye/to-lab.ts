import type { LabExport } from "../lab/import";
import { LAB_PINS } from "../lab/pins";

export interface DesignLike {
  title: string;
  parts: { id: string; type: string; label: string; props: { key: string; value: string }[] }[];
  wires: { from: { part: string; pin: string }; to: { part: string; pin: string } }[];
  code: string;
}

const value = (v: string): number | string | boolean => {
  if (v === "true" || v === "false") return v === "true";
  const n = Number(v.replace(/[^\d.eE+-]/g, ""));
  return /^-?[\d.]+\s*(k|K|M)?\s*(Ω|ohm|cm|mm|°C)?$/.test(v.trim()) && Number.isFinite(n) ? n * (/k|K/.test(v) ? 1000 : /M/.test(v) ? 1e6 : 1) : v;
};

/** The lab's own format: the Uno on the left, everything else in a grid to its right. */
export function designToLab(d: DesignLike): LabExport {
  let i = 0;
  const parts = d.parts.map((p) => {
    const pos = p.type === "uno" ? { x: 40, y: 40 } : { x: 460 + (i % 3) * 200, y: 40 + Math.floor(i++ / 3) * 170 };
    return { id: p.id, type: p.type, ...pos, rotation: 0, props: Object.fromEntries(p.props.map((kv) => [kv.key, value(kv.value)])) };
  });
  const wires = d.wires
    .filter((w) => parts.some((p) => p.id === w.from.part) && parts.some((p) => p.id === w.to.part))
    .map((w, k) => ({ id: `w${k + 1}`, a: w.from, b: w.to }));
  return { v: 1, source: "pcbai-atolye", name: d.title, circuit: { parts, wires }, code: d.code };
}

export const pinsOf = (type: string) => LAB_PINS[type] ?? [];
