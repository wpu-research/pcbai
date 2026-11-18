import type { BoardSpec, Footprint, PartSpec } from "./types";

export interface DrcIssue {
  kind: "out" | "overlap" | "hole";
  refs: string[];
}

/** Axis-aligned box of a part's footprint courtyard after rotation, in board mm. */
export function partBox(fp: Footprint, p: Pick<PartSpec, "x" | "y" | "rot">) {
  const [x0, y0, x1, y1] = fp.bbox;
  const r = (p.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const xs: number[] = [], ys: number[] = [];
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]) {
    xs.push(p.x + x * c - y * s);
    ys.push(p.y + x * s + y * c);
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const EDGE_PARTS = /^J/; // connectors may overhang the edge
const EPS = 0.05;

export function runDrc(spec: BoardSpec, fps: Map<string, Footprint>): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const boxes = spec.parts.flatMap((p) => {
    const fp = fps.get(p.footprint);
    return fp ? [{ p, b: partBox(fp, p) }] : [];
  });
  for (const { p, b } of boxes) {
    const slack = EDGE_PARTS.test(p.ref) ? 2.5 : 0.2;
    if (b.x0 < -slack || b.y0 < -slack || b.x1 > spec.width + slack || b.y1 > spec.height + slack) issues.push({ kind: "out", refs: [p.ref] });
    for (const h of spec.holes) {
      const cx = Math.max(b.x0, Math.min(h.x, b.x1)), cy = Math.max(b.y0, Math.min(h.y, b.y1));
      if (Math.hypot(cx - h.x, cy - h.y) < h.d / 2 + 0.4) issues.push({ kind: "hole", refs: [p.ref] });
    }
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b, b = boxes[j].b;
      if (a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS) issues.push({ kind: "overlap", refs: [boxes[i].p.ref, boxes[j].p.ref] });
    }
  return issues;
}

/* ---------- routing check: traces of different nets that cross ---------- */

type Seg = [[number, number], [number, number]];

function cross(a: Seg, b: Seg) {
  const o = (p: [number, number], q: [number, number], r: [number, number]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const [p1, p2] = a, [p3, p4] = b;
  const share = [p1, p2].some((p) => [p3, p4].some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05));
  if (share) return false;
  return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
}

/** Number of crossings between traces of different nets (each one would be a short on one layer). */
export function routingCrossings(traces: { net: string; points: [number, number][] }[]) {
  const segs: { net: string; s: Seg }[] = [];
  for (const t of traces) for (let i = 0; i < t.points.length - 1; i++) segs.push({ net: t.net.replace(/_.*$/, ""), s: [t.points[i], t.points[i + 1]] });
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) if (segs[i].net !== segs[j].net && cross(segs[i].s, segs[j].s)) n++;
  return n;
}
