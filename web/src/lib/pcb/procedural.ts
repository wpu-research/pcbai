import type { Footprint, Pad } from "./types";

/**
 * Footprints generated in code rather than read from the KiCad library: 2.54 mm pin headers,
 * used as sockets for the breakout modules a circuit from the virtual lab plugs in.
 * Key format matches KiCad's naming: PinHeader_1x{N}_P2.54mm_Vertical.
 */
const HEADER = /^PinHeader_1x(\d{1,2})_P2\.54mm_Vertical$/;

export const headerKey = (n: number) => `PinHeader_1x${n}_P2.54mm_Vertical`;
export const isProcedural = (key: string) => HEADER.test(key);

export function proceduralFootprint(key: string): Footprint | null {
  const m = key.match(HEADER);
  if (!m) return null;
  const n = Math.min(40, Math.max(1, Number(m[1])));
  const pitch = 2.54;
  const x0 = (-(n - 1) * pitch) / 2;
  const pads: Pad[] = Array.from({ length: n }, (_, i) => ({
    number: String(i + 1),
    kind: "tht",
    shape: i === 0 ? "rect" : "circle",
    x: x0 + i * pitch,
    y: 0,
    rotation: 0,
    w: 1.7,
    h: 1.7,
    drill: { w: 1.0, h: 1.0 },
    layers: ["*.Cu", "*.Mask"],
  }));
  const hw = (n * pitch) / 2, hh = pitch / 2;
  const s = 0.12; // silk just outside the body
  return {
    id: `procedural/${key}`,
    name: key,
    pads,
    graphics: [
      { kind: "rect", layer: "F.SilkS", x1: -hw - s, y1: -hh - s, x2: hw + s, y2: hh + s, width: 0.12 },
      { kind: "line", layer: "F.SilkS", x1: x0 - 1.0, y1: -hh - 0.6, x2: x0 + 1.0, y2: -hh - 0.6, width: 0.12 }, // pin 1 mark
      { kind: "rect", layer: "F.CrtYd", x1: -hw - 0.5, y1: -hh - 0.5, x2: hw + 0.5, y2: hh + 0.5, width: 0.05 },
    ],
    bbox: [-hw - 0.5, -hh - 0.9, hw + 0.5, hh + 0.5],
  };
}
