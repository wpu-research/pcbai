import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { proceduralFootprint } from "./procedural";
import type { BoardSpec, Footprint, Pad, PartSpec, Trace } from "./types";

export const LIBRARY = process.env.NEXT_PUBLIC_LIBRARY_BASE || "/library";

/** A single-file build embeds the library: footprints as objects, models as data URIs. */
type Inline = { footprints: Record<string, Footprint>; models: Record<string, string> };
const inline = (): Inline | undefined => (globalThis as { __PCBAI_LIB?: Inline }).__PCBAI_LIB;

export const footprintUrl = (key: string) => `${LIBRARY}/footprints/${key}.json`;
export const modelUrl = (key: string, lo = false) => {
  const file = `${key}${lo ? ".lo.glb" : ".glb"}`;
  return inline()?.models[file] ?? inline()?.models[`${key}.glb`] ?? `${LIBRARY}/models/${file}`;
};

const fpCache = new Map<string, Promise<Footprint>>();
export function loadFootprint(key: string) {
  let p = fpCache.get(key);
  const embedded = inline()?.footprints[key] ?? proceduralFootprint(key);
  if (!p && embedded) {
    p = Promise.resolve(embedded);
    fpCache.set(key, p);
  }
  if (!p) {
    p = fetch(footprintUrl(key)).then((r) => {
      if (!r.ok) throw new Error(`footprint ${key}: ${r.status}`);
      return r.json();
    });
    fpCache.set(key, p);
  }
  return p;
}

export async function loadFootprints(spec: BoardSpec) {
  const keys = [...new Set(spec.parts.map((p) => p.footprint))];
  const fps = await Promise.all(keys.map(loadFootprint));
  return new Map(keys.map((k, i) => [k, fps[i]]));
}

/* ---------- transforms ---------- */

const rad = (d: number) => (d * Math.PI) / 180;

export function toBoard(part: Pick<PartSpec, "x" | "y" | "rot">, x: number, y: number): [number, number] {
  const c = Math.cos(rad(part.rot)), s = Math.sin(rad(part.rot));
  return [part.x + x * c - y * s, part.y + x * s + y * c];
}

const onCopper = (p: Pad) => p.layers.some((l) => l === "F.Cu" || l === "*.Cu");

export function padsOf(fp: Footprint, number?: string) {
  return fp.pads.filter((p) => onCopper(p) && p.kind !== "npth" && (number === undefined || p.number === number));
}

export function padCenter(fp: Footprint, part: PartSpec, number: string): [number, number] {
  const pads = padsOf(fp, number);
  if (!pads.length) return [part.x, part.y];
  // pick the largest pad of that number (exposed pads etc.)
  const p = pads.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
  return toBoard(part, p.x, p.y);
}

/* ---------- flat shape helpers (XY -> XZ at height y) ---------- */

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export function padShape(p: Pick<Pad, "shape" | "w" | "h">) {
  switch (p.shape) {
    case "circle":
      return roundedRect(p.w, p.h, Math.min(p.w, p.h) / 2);
    case "oval":
      return roundedRect(p.w, p.h, Math.min(p.w, p.h) / 2);
    case "roundrect":
      return roundedRect(p.w, p.h, Math.min(p.w, p.h) * 0.25);
    default:
      return roundedRect(p.w, p.h, 0.0001);
  }
}

/** Flat geometry in the XZ plane, facing up, with KiCad (x, y) -> (x, h, y). */
function flat(shape: THREE.Shape, segments = 8) {
  const g = new THREE.ShapeGeometry(shape, segments);
  g.rotateX(Math.PI / 2); // (x, y, 0) -> (x, 0, y)
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

function place(g: THREE.BufferGeometry, part: Pick<PartSpec, "x" | "y" | "rot">, localX: number, localY: number, localRot: number, h: number) {
  g.rotateY(-rad(localRot));
  g.translate(localX, 0, localY);
  g.rotateY(-rad(part.rot));
  g.translate(part.x, h, part.y);
  return g;
}

/* ---------- pads ---------- */

export function partPadGeometry(fp: Footprint, part: PartSpec, h = 0, number?: string) {
  const geos = padsOf(fp, number).map((p) => place(flat(padShape(p)), part, p.x, p.y, p.rotation || 0, h));
  return geos.length ? mergeGeometries(geos) : null;
}

export function partDrillGeometry(fp: Footprint, part: PartSpec, h = 0.002) {
  const geos = fp.pads
    .filter((p) => p.drill && (p.kind === "tht" || p.kind === "npth"))
    .map((p) => place(flat(padShape({ shape: p.drill!.w === p.drill!.h ? "circle" : "oval", w: p.drill!.w, h: p.drill!.h })), part, p.x, p.y, p.rotation || 0, h));
  return geos.length ? mergeGeometries(geos) : null;
}

/* ---------- ribbons (traces, silk, outlines) ---------- */

export function ribbon(points: [number, number][], width: number, h = 0, caps = true) {
  const pos: number[] = [];
  const hw = width / 2;
  const disc = (cx: number, cy: number) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      pos.push(cx, h, cy, cx + Math.cos(a1) * hw, h, cy + Math.sin(a1) * hw, cx + Math.cos(a0) * hw, h, cy + Math.sin(a0) * hw);
    }
  };
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * hw, ny = (dx / len) * hw;
    if (caps) disc(x0, y0);
    pos.push(x0 + nx, h, y0 + ny, x1 + nx, h, y1 + ny, x1 - nx, h, y1 - ny);
    pos.push(x0 + nx, h, y0 + ny, x1 - nx, h, y1 - ny, x0 - nx, h, y0 - ny);
  }
  if (caps && points.length) disc(...points[points.length - 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return g;
}

/** 45° router: straight, diagonal, straight — symmetric about the middle. */
export function route45(a: [number, number], b: [number, number]): [number, number][] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 1e-3 || ay < 1e-3 || Math.abs(ax - ay) < 1e-3) return [a, b];
  const sx = Math.sign(dx), sy = Math.sign(dy);
  if (ax > ay) {
    const run = (ax - ay) / 2;
    return [a, [a[0] + sx * run, a[1]], [b[0] - sx * run, b[1]], b];
  }
  const run = (ay - ax) / 2;
  return [a, [a[0], a[1] + sy * run], [b[0], b[1] - sy * run], b];
}

export function pathLength(points: [number, number][]) {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return l;
}

/* ---------- silkscreen ---------- */

export function partSilkGeometry(fp: Footprint, part: PartSpec, h = 0) {
  const geos: THREE.BufferGeometry[] = [];
  const tx = (x: number, y: number) => toBoard(part, x, y);
  for (const g of fp.graphics) {
    if (g.layer !== "F.SilkS") continue;
    if (g.kind === "line") geos.push(ribbon([tx(g.x1, g.y1), tx(g.x2, g.y2)], Math.max(0.15, g.width), h));
    else if (g.kind === "rect")
      geos.push(ribbon([tx(g.x1, g.y1), tx(g.x2, g.y1), tx(g.x2, g.y2), tx(g.x1, g.y2), tx(g.x1, g.y1)], Math.max(0.15, g.width), h));
    else if (g.kind === "poly") geos.push(ribbon(g.points.map(([x, y]) => tx(x, y)), Math.max(0.15, g.width), h));
    else if (g.kind === "circle" && g.r) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) pts.push(tx(g.cx + Math.cos((i / 24) * Math.PI * 2) * g.r, g.cy + Math.sin((i / 24) * Math.PI * 2) * g.r));
      geos.push(ribbon(pts, Math.max(0.15, g.width), h, false));
    }
  }
  return geos.length ? mergeGeometries(geos) : null;
}

/* ---------- board body ---------- */

export function boardShape(spec: Pick<BoardSpec, "width" | "height" | "radius" | "holes">, withHoles = true) {
  const s = roundedRect(spec.width, spec.height, spec.radius);
  if (withHoles)
    for (const h of spec.holes) {
      const p = new THREE.Path();
      p.absarc(h.x - spec.width / 2, h.y - spec.height / 2, h.d / 2, 0, Math.PI * 2, true);
      s.holes.push(p);
    }
  return s;
}

/** Extruded FR-4 core: top face at y = 0, bottom at -thickness, (0,0) at the board corner. */
export function boardCoreGeometry(spec: BoardSpec) {
  const g = new THREE.ExtrudeGeometry(boardShape(spec), { depth: spec.thickness, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(Math.PI / 2); // extrude +z -> -y
  g.translate(spec.width / 2, 0, spec.height / 2);
  return g;
}

export function boardOutline(spec: BoardSpec): [number, number][] {
  const pts = boardShape(spec, false).getPoints(12);
  return pts.map((p) => [p.x + spec.width / 2, p.y + spec.height / 2]);
}

export function ringGeometry(x: number, y: number, r0: number, r1: number, h: number) {
  const g = new THREE.RingGeometry(r0, r1, 40);
  g.rotateX(-Math.PI / 2);
  g.translate(x, h, y);
  return g;
}

/* ---------- routing a whole board ---------- */

export interface Built {
  traces: Trace[];
  vias: [number, number][];
  airwires: [[number, number], [number, number]][];
}

export function routeBoard(spec: BoardSpec, fps: Map<string, Footprint>): Built {
  const parts = new Map(spec.parts.map((p) => [p.ref, p]));
  const at = (ref: string, num: string) => {
    const part = parts.get(ref)!;
    return padCenter(fps.get(part.footprint)!, part, num);
  };
  const traces: Trace[] = [];
  const vias: [number, number][] = [];
  const airwires: Built["airwires"] = [];
  for (const net of spec.nets) {
    const pts = net.pins.filter(([r]) => parts.has(r)).map(([r, n]) => ({ ref: r, p: at(r, n) }));
    if (net.kind === "ground") {
      // each ground pin drops through a via to the bottom pour
      for (const { ref, p } of pts) {
        const part = parts.get(ref)!;
        let dx = p[0] - part.x, dy = p[1] - part.y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
        const v: [number, number] = [p[0] + dx * 1.3, p[1] + dy * 1.3];
        vias.push(v);
        traces.push({ net: net.name, kind: net.kind, width: net.width, points: [p, v] });
      }
      continue;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].p, b = pts[i + 1].p;
      airwires.push([a, b]);
      traces.push({ net: net.name, kind: net.kind, width: net.width, points: route45(a, b) });
    }
  }
  return { traces, vias, airwires };
}

/* ---------- canvas layers (solder mask openings, bottom pour) ---------- */

export function layerCanvas(spec: BoardSpec, draw: (ctx: CanvasRenderingContext2D, k: number) => void, pxPerMm = 14) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(spec.width * pxPerMm);
  c.height = Math.ceil(spec.height * pxPerMm);
  const ctx = c.getContext("2d")!;
  draw(ctx, pxPerMm);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function fillShape(ctx: CanvasRenderingContext2D, k: number, part: PartSpec, p: Pad, grow = 0) {
  const [cx, cy] = toBoard(part, p.x, p.y);
  ctx.save();
  ctx.translate(cx * k, cy * k);
  ctx.rotate(rad(part.rot + (p.rotation || 0)));
  const w = (p.w + grow) * k, h = (p.h + grow) * k;
  const r = p.shape === "circle" || p.shape === "oval" ? Math.min(w, h) / 2 : p.shape === "roundrect" ? Math.min(w, h) * 0.25 : 0;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.restore();
}
