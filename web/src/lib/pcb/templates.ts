import { AIR_BOARD, FIELD_NODE, REMOTE_BOARD, TAG_BOARD } from "./boards";
import { MASKS } from "./materials";
import type { BoardSpec, MaskName } from "./types";

export const TEMPLATES: Record<string, BoardSpec> = {
  "field-node": FIELD_NODE,
  "air-board": AIR_BOARD,
  "remote-board": REMOTE_BOARD,
  "tag-board": TAG_BOARD,
};

/** Packages a part may be swapped between (same function, different size). */
export const SWAPS: string[][] = [
  ["Resistor_SMD_R_0402_1005Metric", "Resistor_SMD_R_0603_1608Metric", "Resistor_SMD_R_0805_2012Metric", "Resistor_SMD_R_1206_3216Metric"],
  ["Capacitor_SMD_C_0402_1005Metric", "Capacitor_SMD_C_0603_1608Metric", "Capacitor_SMD_C_0805_2012Metric", "Capacitor_SMD_C_1206_3216Metric", "Capacitor_SMD_C_1210_3225Metric"],
  ["LED_SMD_LED_0603_1608Metric", "LED_SMD_LED_0805_2012Metric", "LED_SMD_LED_1206_3216Metric"],
];
export const swapGroup = (fp: string) => SWAPS.find((g) => g.includes(fp)) ?? [fp];
export const shortPkg = (fp: string) => fp.match(/_(\d{4})_/)?.[1] ?? fp.split("_").slice(-1)[0];

export const MASK_NAMES = Object.keys(MASKS) as MaskName[];
export const LIMITS = { min: 15, max: 160 };

export function fromTemplate(key: string, id: string, title: string): BoardSpec {
  const base = TEMPLATES[key] ?? FIELD_NODE;
  return { ...structuredClone(base), id, title };
}

const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, Math.round(n * 100) / 100));
};

/**
 * Accept only the edits the editor allows, on top of the stored design:
 * board size, finish, and each existing part's position, rotation and (within its group) package.
 * Nets, part list and holes stay as stored.
 */
export function applyEdits(stored: BoardSpec, input: unknown): BoardSpec {
  const inp = (input ?? {}) as Partial<BoardSpec>;
  const width = num(inp.width, LIMITS.min, LIMITS.max, stored.width);
  const height = num(inp.height, LIMITS.min, LIMITS.max, stored.height);
  const f = (inp.finish ?? {}) as Partial<BoardSpec["finish"]>;
  const finish: BoardSpec["finish"] = {
    mask: MASK_NAMES.includes(f.mask as MaskName) ? (f.mask as MaskName) : stored.finish.mask,
    silk: f.silk === "black" || f.silk === "white" ? f.silk : stored.finish.silk,
    surface: f.surface === "enig" || f.surface === "hasl" ? f.surface : stored.finish.surface,
  };
  const incoming = new Map((Array.isArray(inp.parts) ? inp.parts : []).map((p) => [p?.ref, p]));
  const parts = stored.parts.map((p) => {
    const e = incoming.get(p.ref);
    if (!e) return p;
    const rot = ((Math.round(num(e.rot, -720, 720, p.rot) / 90) * 90) % 360 + 360) % 360;
    const footprint = swapGroup(p.footprint).includes(e.footprint) ? e.footprint : p.footprint;
    return { ...p, x: num(e.x, -5, width + 5, p.x), y: num(e.y, -5, height + 5, p.y), rot, footprint };
  });
  // keep mounting holes in the corners when the board is resized
  const holes = stored.holes.map((h) => ({
    ...h,
    x: h.x > stored.width / 2 ? width - (stored.width - h.x) : h.x,
    y: h.y > stored.height / 2 ? height - (stored.height - h.y) : h.y,
  }));
  return { ...stored, width, height, finish, parts, holes, radius: stored.radius >= Math.min(stored.width, stored.height) / 2 ? Math.min(width, height) / 2 : stored.radius };
}
