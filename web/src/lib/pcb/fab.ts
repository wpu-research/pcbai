/**
 * Fabrication outputs: RS-274X (X2) Gerbers, Excellon drills, BOM / CPL, README and a
 * printable fabrication drawing (SVG). Pure TypeScript; no DOM, safe on the server.
 *
 * Board coordinates are KiCad-style (mm, y down, origin top-left). Gerber / Excellon / CPL
 * coordinates are y-up with the origin at the board's bottom-left corner: gy = height - y.
 */
import type { BoardSpec, Footprint, Graphic, Pad, PartSpec } from "./types";
import { proceduralFootprint } from "./procedural";
import { routeBoard, toBoard } from "./geometry";

export interface FabFile {
  name: string;
  content: string;
  mime: string;
}

type Pt = [number, number];

/* ---------- constants ---------- */

const VIA_DRILL = 0.4;
const VIA_PAD = 0.9;
const MASK_EXPANSION = 0.05; // per side
const POUR_EDGE_CLEARANCE = 0.3;
const POUR_CLEARANCE = 0.3;
const HOLE_POUR_CLEARANCE = 0.5;
const MIN_SILK_WIDTH = 0.1;
const EDGE_WIDTH = 0.05;
const CORNER_SEGMENTS = 10;

const GERBER_MIME = "application/vnd.gerber";
const SOFTWARE = "PcbAi,fab.ts,1.0";

/* ---------- small helpers ---------- */

const rad = (d: number) => (d * Math.PI) / 180;
const f3 = (v: number) => v.toFixed(3);
const isFront = (l: string) => l === "F.Cu" || l === "*.Cu";
const isBack = (l: string) => l === "B.Cu" || l === "*.Cu";
const hasLayer = (p: Pad, test: (l: string) => boolean) => p.layers.some(test);
const isCopperPad = (p: Pad) => p.kind !== "npth" && hasLayer(p, (l) => isFront(l) || isBack(l));

function partsWithFootprints(spec: BoardSpec, fps: Map<string, Footprint>) {
  const out: { part: PartSpec; fp: Footprint }[] = [];
  for (const part of spec.parts) {
    const fp = fps.get(part.footprint);
    if (fp) out.push({ part, fp });
  }
  return out;
}

/** Rounded rectangle polygon centred at the origin, CCW in a y-down frame doesn't matter for Gerber. */
function roundedRectPoly(w: number, h: number, r: number, seg = CORNER_SEGMENTS): Pt[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const hw = w / 2, hh = h / 2;
  if (r < 1e-6) return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const corners: [number, number, number][] = [
    [hw - r, -hh + r, -90],
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, 90],
    [-hw + r, -hh + r, 180],
  ];
  const pts: Pt[] = [];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = rad(a0 + (90 * i) / seg);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  // drop exact duplicates (fully rounded sides)
  return pts.filter((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6;
  });
}

function circlePoly(cx: number, cy: number, r: number, n = 48): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) pts.push([cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
  return pts;
}

function padRadius(p: Pad, w: number, h: number) {
  if (p.shape === "circle" || p.shape === "oval") return Math.min(w, h) / 2;
  if (p.shape === "roundrect") {
    const ratio = (p as Pad & { roundrect_ratio?: number }).roundrect_ratio ?? 0.25;
    return Math.min(w, h) * ratio;
  }
  return 0;
}

/** Pad outline in board coordinates (y down), grown by `grow` on every side. */
function padPolygon(part: PartSpec, p: Pad, grow = 0): Pt[] {
  const w = p.w + 2 * grow, h = p.h + 2 * grow;
  const r = p.shape === "rect" ? 0 : padRadius(p, p.w, p.h) + grow;
  const c = Math.cos(rad(p.rotation || 0)), s = Math.sin(rad(p.rotation || 0));
  return roundedRectPoly(w, h, r).map(([x, y]) => toBoard(part, p.x + x * c - y * s, p.y + x * s + y * c));
}

function padCentre(part: PartSpec, p: Pad): Pt {
  return toBoard(part, p.x, p.y);
}

/** Board outline (y down), segmented arcs. */
function outlinePolygon(spec: BoardSpec, inset = 0): Pt[] {
  const w = spec.width - 2 * inset, h = spec.height - 2 * inset;
  return roundedRectPoly(w, h, Math.max(0, spec.radius - inset), 16).map(([x, y]) => [x + spec.width / 2, y + spec.height / 2]);
}

/** Circle through three points, or null when collinear. */
function circleFrom3(a: Pt, b: Pt, c: Pt): { cx: number; cy: number; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const sa = a[0] ** 2 + a[1] ** 2, sb = b[0] ** 2 + b[1] ** 2, sc = c[0] ** 2 + c[1] ** 2;
  const cx = (sa * (b[1] - c[1]) + sb * (c[1] - a[1]) + sc * (a[1] - b[1])) / d;
  const cy = (sa * (c[0] - b[0]) + sb * (a[0] - c[0]) + sc * (b[0] - a[0])) / d;
  return { cx, cy, r: Math.hypot(a[0] - cx, a[1] - cy) };
}

/** Polyline through an arc defined by start/mid/end (footprint-local). */
function arcPoints(start: Pt, mid: Pt, end: Pt): Pt[] {
  const c = circleFrom3(start, mid, end);
  if (!c) return [start, end];
  const ang = (p: Pt) => Math.atan2(p[1] - c.cy, p[0] - c.cx);
  const a0 = ang(start), am = ang(mid), a1 = ang(end);
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let sweep = norm(a1 - a0);
  if (norm(am - a0) > sweep) sweep -= 2 * Math.PI; // mid lies on the other way round
  const n = Math.max(6, Math.ceil((Math.abs(sweep) * 180) / Math.PI / 10));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    pts.push([c.cx + Math.cos(a) * c.r, c.cy + Math.sin(a) * c.r]);
  }
  return pts;
}

/** Footprint graphic -> polylines (footprint-local) plus whether it is a filled polygon. */
function graphicPaths(g: Graphic): { pts: Pt[]; closed: boolean; fill: boolean; width: number }[] {
  const fill = Boolean((g as Graphic & { fill?: boolean | string }).fill) && (g as { fill?: unknown }).fill !== "none";
  switch (g.kind) {
    case "line":
      return [{ pts: [[g.x1, g.y1], [g.x2, g.y2]], closed: false, fill: false, width: g.width }];
    case "rect":
      return [{ pts: [[g.x1, g.y1], [g.x2, g.y1], [g.x2, g.y2], [g.x1, g.y2]], closed: true, fill, width: g.width }];
    case "poly":
      return g.points.length > 1 ? [{ pts: g.points, closed: true, fill, width: g.width }] : [];
    case "circle": {
      const r = g.r ?? (g.ex !== undefined && g.ey !== undefined ? Math.hypot(g.ex - g.cx, g.ey - g.cy) : 0);
      return r > 0 ? [{ pts: circlePoly(g.cx, g.cy, r, 36), closed: true, fill, width: g.width }] : [];
    }
    case "arc":
      if (g.start && g.mid && g.end) return [{ pts: arcPoints(g.start, g.mid, g.end), closed: false, fill: false, width: g.width }];
      return [];
    default:
      return [];
  }
}

function netIndex(spec: BoardSpec) {
  const m = new Map<string, BoardSpec["nets"][number]>();
  for (const n of spec.nets) for (const [ref, num] of n.pins) m.set(`${ref}:${num}`, n);
  return m;
}

/* ---------- Gerber writer ---------- */

class Gerber {
  private body: string[] = [];
  private apertures = new Map<string, string>();
  private nextD = 10;
  private current = "";
  private attr = "";

  constructor(
    private spec: BoardSpec,
    private fileFunction: string,
    private polarity: "Positive" | "Negative" = "Positive",
  ) {}

  private c(v: number) {
    return Math.round(v * 1e6).toString();
  }
  /** Board (y down) -> Gerber coordinate string. */
  private xy([x, y]: Pt) {
    return `X${this.c(x)}Y${this.c(this.spec.height - y)}`;
  }

  private setAttr(func?: string) {
    const want = func ?? "";
    if (want === this.attr) return;
    if (this.attr) this.body.push("%TD.AperFunction*%");
    if (want) this.body.push(`%TA.AperFunction,${want}*%`);
    this.attr = want;
  }

  /** Select (defining on first use) an aperture, e.g. "C,0.250000". */
  private use(template: string, func?: string) {
    const key = `${template}|${func ?? ""}`;
    let d = this.apertures.get(key);
    if (!d) {
      d = `D${this.nextD++}`;
      this.setAttr(func);
      this.body.push(`%AD${d}${template}*%`);
      this.apertures.set(key, d);
    }
    if (d !== this.current) {
      this.body.push(`${d}*`);
      this.current = d;
    }
  }

  polarityDark(dark: boolean) {
    this.body.push(dark ? "%LPD*%" : "%LPC*%");
  }

  comment(text: string) {
    this.body.push(`G04 ${text.replace(/[*%]/g, "")}*`);
  }

  flashCircle(at: Pt, d: number, func?: string) {
    this.use(`C,${d.toFixed(6)}`, func);
    this.body.push(`${this.xy(at)}D03*`);
  }

  stroke(points: Pt[], width: number, func?: string) {
    if (points.length < 2) return;
    this.use(`C,${width.toFixed(6)}`, func);
    this.body.push(`${this.xy(points[0])}D02*`);
    for (let i = 1; i < points.length; i++) this.body.push(`${this.xy(points[i])}D01*`);
  }

  region(points: Pt[], func?: string) {
    if (points.length < 3) return;
    this.setAttr(func);
    this.body.push("G36*");
    this.body.push(`${this.xy(points[0])}D02*`);
    for (let i = 1; i < points.length; i++) this.body.push(`${this.xy(points[i])}D01*`);
    this.body.push(`${this.xy(points[0])}D01*`);
    this.body.push("G37*");
  }

  /** Rounded-rect board profile with true circular arcs (G75 / G03). */
  profile(spec: BoardSpec) {
    this.use(`C,${EDGE_WIDTH.toFixed(6)}`, "Profile");
    const W = spec.width, H = spec.height, r = Math.min(spec.radius, W / 2, H / 2);
    // Work directly in Gerber (y-up) space via a y-down helper: gy = H - y.
    const P = (gx: number, gy: number) => this.xy([gx, H - gy]);
    const IJ = (i: number, j: number) => `I${this.c(i)}J${this.c(j)}`;
    const b = this.body;
    b.push("G75*");
    b.push(`${P(r, 0)}D02*`);
    b.push("G01*");
    b.push(`${P(W - r, 0)}D01*`);
    if (r > 0) b.push(`G03*${P(W, r)}${IJ(0, r)}D01*`, "G01*");
    b.push(`${P(W, H - r)}D01*`);
    if (r > 0) b.push(`G03*${P(W - r, H)}${IJ(-r, 0)}D01*`, "G01*");
    b.push(`${P(r, H)}D01*`);
    if (r > 0) b.push(`G03*${P(0, H - r)}${IJ(0, -r)}D01*`, "G01*");
    b.push(`${P(0, r)}D01*`);
    if (r > 0) b.push(`G03*${P(r, 0)}${IJ(r, 0)}D01*`, "G01*");
  }

  toString() {
    if (this.attr) this.body.push("%TD.AperFunction*%");
    this.attr = "";
    const head = [
      `%TF.GenerationSoftware,${SOFTWARE}*%`,
      `%TF.CreationDate,${new Date().toISOString().replace(/\.\d+Z$/, "+00:00")}*%`,
      `%TF.ProjectId,${this.spec.id.replace(/[,*%]/g, "_")},00000000-0000-0000-0000-000000000000,1*%`,
      "%TF.SameCoordinates,Original*%",
      `%TF.FileFunction,${this.fileFunction}*%`,
      `%TF.FilePolarity,${this.polarity}*%`,
      "%FSLAX46Y46*%",
      "G04 Gerber Fmt 4.6, Leading zero omitted, Abs format (unit mm)*",
      `G04 ${this.spec.title.replace(/[*%]/g, "")} -- ${this.spec.width} x ${this.spec.height} mm*`,
      "%MOMM*%",
      "%LPD*%",
      "G01*",
    ];
    return [...head, ...this.body, "M02*", ""].join("\n");
  }
}

/* ---------- layers ---------- */

function copperLayer(spec: BoardSpec, fps: Map<string, Footprint>, side: "top" | "bottom") {
  const g = new Gerber(spec, side === "top" ? "Copper,L1,Top" : "Copper,L2,Bot");
  const { traces, vias } = routeBoard(spec, fps);
  const placed = partsWithFootprints(spec, fps);
  const nets = netIndex(spec);
  const onSide = side === "top" ? isFront : isBack;

  const drawPad = (part: PartSpec, p: Pad) => {
    const func = p.kind === "smd" ? "SMDPad,CuDef" : "ComponentPad";
    if (p.shape === "circle" && Math.abs(p.w - p.h) < 1e-6) g.flashCircle(padCentre(part, p), p.w, func);
    else g.region(padPolygon(part, p), func);
  };

  if (side === "bottom") {
    // Ground pour: whole board (pulled back from the edge), knocked out around anything that isn't ground.
    g.comment("ground pour");
    g.region(outlinePolygon(spec, POUR_EDGE_CLEARANCE), "Conductor");
    g.polarityDark(false);
    for (const h of spec.holes) g.region(circlePoly(h.x, h.y, h.d / 2 + HOLE_POUR_CLEARANCE), "Conductor");
    for (const { part, fp } of placed)
      for (const p of fp.pads) {
        if (p.kind === "npth") {
          const d = p.drill ? Math.max(p.drill.w, p.drill.h) : Math.max(p.w, p.h);
          g.region(circlePoly(...padCentre(part, p), d / 2 + POUR_CLEARANCE, 32), "Conductor");
          continue;
        }
        if (!isCopperPad(p) || !hasLayer(p, isBack)) continue;
        const net = nets.get(`${part.ref}:${p.number}`);
        // Pads on a signal/power net are isolated; ground and unnetted pads (shields, thermal vias) join the pour.
        if (net && net.kind !== "ground") g.region(padPolygon(part, p, POUR_CLEARANCE), "Conductor");
      }
    g.polarityDark(true);
  }

  g.comment("pads");
  for (const { part, fp } of placed) for (const p of fp.pads) if (isCopperPad(p) && hasLayer(p, onSide)) drawPad(part, p);

  g.comment("vias");
  for (const v of vias) g.flashCircle(v, VIA_PAD, "ViaPad");

  if (side === "top") {
    g.comment("traces");
    for (const t of traces) g.stroke(t.points, t.width, "Conductor");
  }
  return g.toString();
}

function maskLayer(spec: BoardSpec, fps: Map<string, Footprint>, side: "top" | "bottom") {
  const g = new Gerber(spec, side === "top" ? "Soldermask,Top" : "Soldermask,Bot", "Negative");
  const want = side === "top" ? "F.Mask" : "B.Mask";
  for (const { part, fp } of partsWithFootprints(spec, fps))
    for (const p of fp.pads) {
      if (!p.layers.some((l) => l === want || l === "*.Mask")) continue;
      if (p.shape === "circle" && Math.abs(p.w - p.h) < 1e-6) g.flashCircle(padCentre(part, p), p.w + 2 * MASK_EXPANSION);
      else g.region(padPolygon(part, p, MASK_EXPANSION));
    }
  // mount holes: open the mask so the hole wall is clean
  for (const h of spec.holes) g.flashCircle([h.x, h.y], h.d + 2 * MASK_EXPANSION + 0.2);
  return g.toString();
}

function pasteLayer(spec: BoardSpec, fps: Map<string, Footprint>) {
  const g = new Gerber(spec, "Paste,Top");
  for (const { part, fp } of partsWithFootprints(spec, fps))
    for (const p of fp.pads) {
      if (p.kind !== "smd" || !p.layers.includes("F.Paste")) continue;
      if (p.shape === "circle" && Math.abs(p.w - p.h) < 1e-6) g.flashCircle(padCentre(part, p), p.w);
      else g.region(padPolygon(part, p));
    }
  return g.toString();
}

function silkLayer(spec: BoardSpec, fps: Map<string, Footprint>) {
  const g = new Gerber(spec, "Legend,Top");
  for (const { part, fp } of partsWithFootprints(spec, fps)) {
    const tx = ([x, y]: Pt) => toBoard(part, x, y);
    for (const gr of fp.graphics) {
      if (gr.layer !== "F.SilkS") continue;
      for (const path of graphicPaths(gr)) {
        const pts = path.pts.map(tx);
        if (path.fill && path.closed && pts.length >= 3) g.region(pts);
        g.stroke(path.closed ? [...pts, pts[0]] : pts, Math.max(MIN_SILK_WIDTH, path.width));
      }
    }
  }
  return g.toString();
}

function edgeLayer(spec: BoardSpec) {
  const g = new Gerber(spec, "Profile,NP");
  g.profile(spec);
  return g.toString();
}

/* ---------- drills (Excellon) ---------- */

interface Hole {
  at: Pt;
  d: number;
  /** slot end points (board coords) when the hole is oblong */
  slot?: [Pt, Pt];
}

function collectHoles(spec: BoardSpec, fps: Map<string, Footprint>) {
  const pth: Hole[] = [];
  const npth: Hole[] = [];
  for (const { part, fp } of partsWithFootprints(spec, fps))
    for (const p of fp.pads) {
      if (!p.drill || (p.kind !== "tht" && p.kind !== "npth")) continue;
      const { w, h } = p.drill;
      const at = padCentre(part, p);
      const hole: Hole = { at, d: Math.min(w, h) };
      if (Math.abs(w - h) > 1e-6) {
        const half = (Math.max(w, h) - Math.min(w, h)) / 2;
        const [lx, ly] = w > h ? [half, 0] : [0, half];
        const c = Math.cos(rad(p.rotation || 0)), s = Math.sin(rad(p.rotation || 0));
        const local = (k: number): Pt => [p.x + k * (lx * c - ly * s), p.y + k * (lx * s + ly * c)];
        hole.slot = [toBoard(part, ...local(-1)), toBoard(part, ...local(1))];
      }
      (p.kind === "npth" ? npth : pth).push(hole);
    }
  for (const v of routeBoard(spec, fps).vias) pth.push({ at: v, d: VIA_DRILL });
  for (const h of spec.holes) npth.push({ at: [h.x, h.y], d: h.d });
  return { pth, npth };
}

function excellon(spec: BoardSpec, holes: Hole[], plated: boolean) {
  const X = ([x, y]: Pt) => `X${f3(x)}Y${f3(spec.height - y)}`;
  const tools = [...new Set(holes.map((h) => h.d.toFixed(3)))].sort((a, b) => +a - +b);
  const out: string[] = [
    "M48",
    `; DRILL file {${SOFTWARE}} date ${new Date().toISOString()}`,
    "; FORMAT={-:-/ absolute / metric / decimal}",
    `; #@! TF.CreationDate,${new Date().toISOString()}`,
    `; #@! TF.GenerationSoftware,${SOFTWARE}`,
    `; #@! TF.FileFunction,${plated ? "Plated,1,2,PTH" : "NonPlated,1,2,NPTH"}`,
    "FMAT,2",
    "METRIC",
  ];
  tools.forEach((d, i) => {
    out.push(`; #@! TA.AperFunction,${plated ? "Plated,PTH,ComponentDrill" : "NonPlated,NPTH,ComponentDrill"}`);
    out.push(`T${i + 1}C${d}`);
  });
  out.push("%", "G90", "G05");
  tools.forEach((d, i) => {
    out.push(`T${i + 1}`);
    for (const h of holes) {
      if (h.d.toFixed(3) !== d) continue;
      out.push(h.slot ? `${X(h.slot[0])}G85${X(h.slot[1])}` : X(h.at));
    }
  });
  out.push("M30", "");
  return out.join("\n");
}

/* ---------- assembly ---------- */

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells: (string | number)[]) => cells.map(csvCell).join(",");

function naturalRef(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function bomCsv(spec: BoardSpec) {
  const groups = new Map<string, { name: string; footprint: string; refs: string[] }>();
  for (const p of spec.parts) {
    const key = `${p.name}\u0000${p.footprint}`;
    const g = groups.get(key) ?? { name: p.name, footprint: p.footprint, refs: [] };
    g.refs.push(p.ref);
    groups.set(key, g);
  }
  const rows = [...groups.values()]
    .map((g) => ({ ...g, refs: g.refs.sort(naturalRef) }))
    .sort((a, b) => naturalRef(a.refs[0], b.refs[0]));
  return [csvRow(["Comment", "Designator", "Footprint", "Quantity"]), ...rows.map((g) => csvRow([g.name, g.refs.join(","), g.footprint, g.refs.length]))].join("\n") + "\n";
}

function cplCsv(spec: BoardSpec) {
  const rows = [...spec.parts].sort((a, b) => naturalRef(a.ref, b.ref));
  // Our rotation is clockwise on screen (y down); JLCPCB expects counter-clockwise seen from the top.
  const ccw = (r: number) => (((-r % 360) + 360) % 360).toFixed(0);
  return (
    [
      csvRow(["Designator", "Mid X", "Mid Y", "Layer", "Rotation"]),
      ...rows.map((p) => csvRow([p.ref, `${f3(p.x)}mm`, `${f3(spec.height - p.y)}mm`, "Top", ccw(p.rot)])),
    ].join("\n") + "\n"
  );
}

function readme(spec: BoardSpec, files: string[], holes: { pth: Hole[]; npth: Hole[] }) {
  const lines = [
    `${spec.title} (${spec.id})`,
    "=".repeat(spec.title.length + spec.id.length + 3),
    "",
    `Board size     : ${spec.width} x ${spec.height} mm, corner radius ${spec.radius} mm`,
    `Thickness      : ${spec.thickness} mm FR-4`,
    "Layers         : 2 (top signal, bottom ground pour)",
    `Solder mask    : ${spec.finish.mask}`,
    `Silkscreen     : ${spec.finish.silk} (top only)`,
    `Surface finish : ${spec.finish.surface.toUpperCase()}`,
    `Copper weight  : 1 oz (35 um) both sides`,
    `Components     : ${spec.parts.length} placements, top side only`,
    `Drills         : ${holes.pth.length} plated (incl. vias ${VIA_DRILL} mm), ${holes.npth.length} non-plated`,
    "Units / origin : millimetres, origin at the board's bottom-left corner",
    "",
    "Files",
    "-----",
    ...files.map((f) => {
      const tail = f.slice(spec.id.length + 1);
      const what: Record<string, string> = {
        "F_Cu.gbr": "Top copper (L1)",
        "B_Cu.gbr": "Bottom copper (L2), ground pour",
        "F_Mask.gbr": "Top solder mask (openings)",
        "B_Mask.gbr": "Bottom solder mask (openings)",
        "F_Silkscreen.gbr": "Top silkscreen / legend",
        "F_Paste.gbr": "Top solder paste (stencil)",
        "Edge_Cuts.gbr": "Board outline / profile",
        "PTH.drl": "Plated through holes, Excellon (metric)",
        "NPTH.drl": "Non-plated holes, Excellon (metric)",
        "bom.csv": "Bill of materials",
        "cpl.csv": "Component placement list (JLCPCB format)",
        "README.txt": "This file",
      };
      return `  ${f.padEnd(spec.id.length + 22)} ${what[tail] ?? ""}`;
    }),
    "",
    "Gerbers are RS-274X with X2 attributes, format 4.6 mm. Vias are tented.",
    "Placement rotations in cpl.csv are counter-clockwise viewed from the top; check",
    "polarity-marked parts against your assembler's footprint library before ordering.",
    "",
    `Generated by PcbAi (fab.ts) on ${new Date().toISOString().slice(0, 10)}.`,
    "",
  ];
  return lines.join("\n");
}

/* ---------- public API ---------- */

export function buildFabFiles(spec: BoardSpec, fps: Map<string, Footprint>): FabFile[] {
  const n = (s: string) => `${spec.id}-${s}`;
  const holes = collectHoles(spec, fps);
  const files: FabFile[] = [
    { name: n("F_Cu.gbr"), content: copperLayer(spec, fps, "top"), mime: GERBER_MIME },
    { name: n("B_Cu.gbr"), content: copperLayer(spec, fps, "bottom"), mime: GERBER_MIME },
    { name: n("F_Mask.gbr"), content: maskLayer(spec, fps, "top"), mime: GERBER_MIME },
    { name: n("B_Mask.gbr"), content: maskLayer(spec, fps, "bottom"), mime: GERBER_MIME },
    { name: n("F_Silkscreen.gbr"), content: silkLayer(spec, fps), mime: GERBER_MIME },
    { name: n("F_Paste.gbr"), content: pasteLayer(spec, fps), mime: GERBER_MIME },
    { name: n("Edge_Cuts.gbr"), content: edgeLayer(spec), mime: GERBER_MIME },
    { name: n("PTH.drl"), content: excellon(spec, holes.pth, true), mime: "text/plain" },
    { name: n("NPTH.drl"), content: excellon(spec, holes.npth, false), mime: "text/plain" },
    { name: n("bom.csv"), content: bomCsv(spec), mime: "text/csv" },
    { name: n("cpl.csv"), content: cplCsv(spec), mime: "text/csv" },
  ];
  files.push({ name: n("README.txt"), content: readme(spec, [...files.map((f) => f.name), n("README.txt")], holes), mime: "text/plain" });
  return files;
}

/** Server-only: read every footprint the spec uses from public/library/footprints. */
export async function loadFootprintsFromDisk(spec: BoardSpec, dir?: string): Promise<Map<string, Footprint>> {
  const fs: typeof import("node:fs/promises") = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "node:fs/promises");
  const base = (dir ?? `${process.cwd()}/public/library/footprints`).replace(/\/+$/, "");
  const keys = [...new Set(spec.parts.map((p) => p.footprint))];
  const fps = await Promise.all(keys.map(async (k) => proceduralFootprint(k) ?? (JSON.parse(await fs.readFile(`${base}/${k}.json`, "utf8")) as Footprint)));
  return new Map(keys.map((k, i) => [k, fps[i]]));
}

/* ---------- fabrication drawing (SVG) ---------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function fabDrawingSvg(spec: BoardSpec, fps: Map<string, Footprint>): string {
  const W = spec.width, H = spec.height;
  const m = 14; // margin left/top for dimensions
  const ox = m + 4, oy = m; // board origin in drawing
  const tableRows = spec.holes.length + 1;
  const blockH = Math.max(26, 6 + tableRows * 3.2);
  const svgW = Math.max(ox + W + 10, 150);
  const svgH = oy + H + 12 + blockH + 6;
  const P = ([x, y]: Pt) => `${f3(ox + x)},${f3(oy + y)}`;
  const path = (pts: Pt[], close: boolean) => `M${pts.map(P).join("L")}${close ? "Z" : ""}`;
  const out: string[] = [];
  const t = (x: number, y: number, s: string, size = 1.6, anchor = "start", extra = "") =>
    `<text x="${f3(x)}" y="${f3(y)}" font-size="${size}" text-anchor="${anchor}"${extra}>${esc(s)}</text>`;

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f3(svgW)}mm" height="${f3(svgH)}mm" viewBox="0 0 ${f3(svgW)} ${f3(svgH)}" font-family="Helvetica, Arial, sans-serif" fill="#111">`,
    `<title>${esc(spec.title)} fabrication drawing</title>`,
    `<defs><marker id="arr" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="2.4" markerHeight="2.4" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0.8L6,3L0,5.2Z" fill="#111"/></marker></defs>`,
    `<rect x="0" y="0" width="${f3(svgW)}" height="${f3(svgH)}" fill="#fff"/>`,
    `<rect x="1" y="1" width="${f3(svgW - 2)}" height="${f3(svgH - 2)}" fill="none" stroke="#111" stroke-width="0.35"/>`,
  );

  // board outline + mount holes
  out.push(`<path d="${path(outlinePolygon(spec), true)}" fill="none" stroke="#111" stroke-width="0.3"/>`);

  // parts: courtyard (dashed) + fab outline + reference designator
  for (const { part, fp } of partsWithFootprints(spec, fps)) {
    const tx = ([x, y]: Pt) => toBoard(part, x, y);
    let crt = 0;
    for (const gr of fp.graphics) {
      if (gr.layer !== "F.CrtYd" && gr.layer !== "F.Fab") continue;
      const isCrt = gr.layer === "F.CrtYd";
      for (const p of graphicPaths(gr)) {
        if (isCrt) crt++;
        out.push(
          `<path d="${path(p.pts.map(tx), p.closed)}" fill="none" stroke="${isCrt ? "#888" : "#333"}" stroke-width="${isCrt ? 0.08 : 0.12}"${isCrt ? ' stroke-dasharray="0.4 0.25"' : ""}/>`,
        );
      }
    }
    if (!crt) {
      const [x0, y0, x1, y1] = fp.bbox;
      out.push(`<path d="${path([tx([x0, y0]), tx([x1, y0]), tx([x1, y1]), tx([x0, y1])], true)}" fill="none" stroke="#888" stroke-width="0.08" stroke-dasharray="0.4 0.25"/>`);
    }
    // pin-1 dot helps orientation on the assembly drawing
    const pin1 = fp.pads.find((p) => p.number === "1" || p.number === "A1");
    if (pin1) {
      const [px, py] = toBoard(part, pin1.x, pin1.y);
      out.push(`<circle cx="${f3(ox + px)}" cy="${f3(oy + py)}" r="0.18" fill="#111"/>`);
    }
    const [cx, cy] = [part.x, part.y];
    const size = Math.max(1, Math.min(1.6, Math.min(Math.abs(fp.bbox[2] - fp.bbox[0]), Math.abs(fp.bbox[3] - fp.bbox[1])) * 0.45));
    // white halo underneath (separate element: paint-order isn't supported by every renderer)
    out.push(t(ox + cx, oy + cy + size * 0.35, part.ref, size, "middle", ' font-weight="bold" fill="#fff" stroke="#fff" stroke-width="0.4"'));
    out.push(t(ox + cx, oy + cy + size * 0.35, part.ref, size, "middle", ' font-weight="bold"'));
  }

  // holes: drawn circle, centre mark and diameter callout
  spec.holes.forEach((h, i) => {
    const x = ox + h.x, y = oy + h.y, r = h.d / 2;
    out.push(`<circle cx="${f3(x)}" cy="${f3(y)}" r="${f3(r)}" fill="none" stroke="#111" stroke-width="0.2"/>`);
    out.push(`<path d="M${f3(x - r - 0.6)},${f3(y)}H${f3(x + r + 0.6)}M${f3(x)},${f3(y - r - 0.6)}V${f3(y + r + 0.6)}" stroke="#111" stroke-width="0.08"/>`);
    // label sits just outside the nearest board corner so it never collides with parts
    const left = h.x < W / 2, top = h.y < H / 2;
    out.push(t(ox + (left ? -0.8 : W + 0.8), oy + (top ? -0.8 : H + 2), `H${i + 1}`, 1.4, left ? "end" : "start", ' font-weight="bold"'));
  });

  // overall dimensions
  const dimW = oy - 7, dimH = ox - 9;
  out.push(
    `<g stroke="#111" stroke-width="0.12" fill="none">`,
    `<path d="M${f3(ox)},${f3(oy - 1)}V${f3(dimW - 1.5)}M${f3(ox + W)},${f3(oy - 1)}V${f3(dimW - 1.5)}"/>`,
    `<path d="M${f3(ox)},${f3(dimW)}H${f3(ox + W)}" marker-start="url(#arr)" marker-end="url(#arr)"/>`,
    `<path d="M${f3(ox - 1)},${f3(oy)}H${f3(dimH - 1.5)}M${f3(ox - 1)},${f3(oy + H)}H${f3(dimH - 1.5)}"/>`,
    `<path d="M${f3(dimH)},${f3(oy)}V${f3(oy + H)}" marker-start="url(#arr)" marker-end="url(#arr)"/>`,
    `</g>`,
    t(ox + W / 2, dimW - 0.8, `${W.toFixed(2)} mm`, 2, "middle"),
    t(dimH - 0.8, oy + H / 2, `${H.toFixed(2)} mm`, 2, "middle", ` transform="rotate(-90 ${f3(dimH - 0.8)} ${f3(oy + H / 2)})"`),
    t(ox + W, oy + H + 4, `R${spec.radius} corners (×4)`, 1.4, "end"),
    t(ox, oy + H + 4, "Origin (0,0): bottom-left corner", 1.4, "start"),
    t(ox + W / 2, oy + H + 4, `${spec.holes.length}× mount hole, NPTH (see table)`, 1.4, "middle"),
  );

  // hole table (bottom-left) and title block (bottom-right)
  const by = oy + H + 8;
  out.push(`<g stroke="#111" stroke-width="0.2" fill="none"><rect x="4" y="${f3(by)}" width="58" height="${f3(blockH)}"/></g>`);
  out.push(t(6, by + 3.4, "HOLE TABLE (from bottom-left)", 1.6, "start", ' font-weight="bold"'));
  out.push(t(6, by + 6.6, "ID        X        Y       Ø    TYPE", 1.3, "start", ' font-family="monospace" xml:space="preserve" style="white-space:pre"'));
  spec.holes.forEach((h, i) => {
    const row = `${`H${i + 1}`.padEnd(6)} ${h.x.toFixed(2).padStart(6)}   ${(H - h.y).toFixed(2).padStart(6)}   ${h.d.toFixed(2).padStart(5)}   NPTH`;
    out.push(t(6, by + 9.6 + i * 3, row, 1.3, "start", ' font-family="monospace" xml:space="preserve" style="white-space:pre"'));
  });

  const tbX = svgW - 4 - 80, tbW = 80;
  const rows: [string, string][] = [
    ["TITLE", spec.title],
    ["PART NO.", spec.id],
    ["SIZE", `${W} × ${H} × ${spec.thickness} mm, R${spec.radius}`],
    ["LAYERS", "2 — top signal / bottom GND pour"],
    ["FINISH", `${spec.finish.surface.toUpperCase()}, ${spec.finish.mask} mask, ${spec.finish.silk} silk`],
    ["DATE", "____-__-__        REV  A"],
  ];
  const rh = blockH / rows.length;
  out.push(`<g stroke="#111" stroke-width="0.2" fill="none"><rect x="${f3(tbX)}" y="${f3(by)}" width="${tbW}" height="${f3(blockH)}"/>`);
  for (let i = 1; i < rows.length; i++) out.push(`<path d="M${f3(tbX)},${f3(by + i * rh)}h${tbW}"/>`);
  out.push(`<path d="M${f3(tbX + 16)},${f3(by)}v${f3(blockH)}"/></g>`);
  rows.forEach(([k, v], i) => {
    const y = by + i * rh + rh / 2 + 0.5;
    out.push(t(tbX + 1.2, y, k, 1.2, "start", ' fill="#555"'));
    out.push(t(tbX + 17.2, y, v, i === 0 ? 1.8 : 1.4, "start", i === 0 ? ' font-weight="bold"' : ""));
  });
  out.push(t(svgW - 4, svgH - 2.2, "ALL DIMENSIONS IN MM · GENERATED BY PCBAI", 1.1, "end", ' fill="#555"'));

  out.push("</svg>");
  return out.join("\n");
}
