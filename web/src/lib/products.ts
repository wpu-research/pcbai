import * as THREE from "three";
import { AIR_BOARD, REMOTE_BOARD, TAG_BOARD } from "./pcb/boards";
import type { BoardSpec } from "./pcb/types";

/* ---------- materials ---------- */

export type MatName =
  | "abs-white"
  | "abs-white-gloss"
  | "abs-graphite"
  | "tpe-soft"
  | "silicone"
  | "anodised-black"
  | "aluminium-blasted"
  | "steel"
  | "gold"
  | "glass-cover"
  | "light-pipe"
  | "pouch"
  | "rubber";

const MAT: Record<MatName, () => THREE.Material> = {
  "abs-white": () => new THREE.MeshPhysicalMaterial({ color: "#e0dfdb", roughness: 0.45, specularIntensity: 0.35, clearcoat: 0.15, clearcoatRoughness: 0.45, envMapIntensity: 0.3 }),
  "abs-white-gloss": () => new THREE.MeshPhysicalMaterial({ color: "#e4e9e6", roughness: 0.22, specularIntensity: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.3 }),
  "abs-graphite": () => new THREE.MeshPhysicalMaterial({ color: "#2d3035", roughness: 0.46, specularIntensity: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.26, envMapIntensity: 0.25 }),
  "tpe-soft": () => new THREE.MeshPhysicalMaterial({ color: "#1d1e21", roughness: 0.88, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color("#868c96"), envMapIntensity: 0.15 }),
  silicone: () => new THREE.MeshPhysicalMaterial({ color: "#24262c", roughness: 0.5, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color("#4a4e58"), envMapIntensity: 0.25 }),
  "anodised-black": () => new THREE.MeshStandardMaterial({ color: "#141518", metalness: 0.4, roughness: 0.5, envMapIntensity: 0.4 }),
  "aluminium-blasted": () => new THREE.MeshStandardMaterial({ color: "#c9cdd2", metalness: 0.55, roughness: 0.48, envMapIntensity: 0.35 }),
  steel: () => new THREE.MeshStandardMaterial({ color: "#9a9ea3", metalness: 1, roughness: 0.3, envMapIntensity: 1 }),
  gold: () => new THREE.MeshStandardMaterial({ color: "#d4ab55", metalness: 1, roughness: 0.2, envMapIntensity: 0.8 }),
  "glass-cover": () => new THREE.MeshPhysicalMaterial({ color: "#030405", roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.8 }),
  "light-pipe": () => new THREE.MeshStandardMaterial({ color: "#d8f2f5", emissive: "#5bd0dc", emissiveIntensity: 1.6, toneMapped: false }),
  pouch: () => new THREE.MeshStandardMaterial({ color: "#b9bdc2", metalness: 0.7, roughness: 0.38, envMapIntensity: 0.6 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: "#1a1a1b", roughness: 0.92, envMapIntensity: 0.2 }),
};

export function productMaterial(name: MatName) {
  const m = MAT[name]();
  m.transparent = false;
  return m;
}

/* ---------- geometry ---------- */

export type Shape =
  | { kind: "box"; w: number; d: number; h: number; r: number; bevel?: number } // rounded box, base at y=0
  | { kind: "cyl"; r: number; h: number; seg?: number }
  | { kind: "dome"; r: number; h: number }
  | { kind: "torus"; r: number; tube: number }
  | { kind: "screw"; r: number; h: number }
  | { kind: "screen"; w: number; d: number; screen: "air" | "off" };

function roundedRectShape(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  r = Math.min(r, w / 2, d / 2);
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

const cache = new Map<string, THREE.BufferGeometry>();

export function shapeGeometry(s: Shape): THREE.BufferGeometry {
  const key = JSON.stringify(s);
  const hit = cache.get(key);
  if (hit) return hit;
  let g: THREE.BufferGeometry;
  switch (s.kind) {
    case "box": {
      const b = s.bevel ?? Math.min(1.6, s.h / 3);
      g = new THREE.ExtrudeGeometry(roundedRectShape(s.w - 2 * b, s.d - 2 * b, Math.max(0.1, s.r - b)), {
        depth: s.h - 2 * b,
        bevelEnabled: true,
        bevelThickness: b,
        bevelSize: b,
        bevelSegments: 4,
        curveSegments: 24,
      });
      g.rotateX(-Math.PI / 2);
      g.translate(0, b, 0);
      break;
    }
    case "cyl":
      g = new THREE.CylinderGeometry(s.r, s.r, s.h, s.seg ?? 64);
      g.translate(0, s.h / 2, 0);
      break;
    case "dome": {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * (Math.PI / 2);
        pts.push(new THREE.Vector2(Math.cos(a) * s.r, Math.sin(a) * s.h));
      }
      pts.push(new THREE.Vector2(0, s.h));
      g = new THREE.LatheGeometry(pts.reverse(), 64);
      break;
    }
    case "torus":
      g = new THREE.TorusGeometry(s.r, s.tube, 16, 96);
      g.rotateX(Math.PI / 2);
      break;
    case "screw": {
      const head = new THREE.CylinderGeometry(s.r * 1.9, s.r * 1.9, 1.2, 24);
      head.translate(0, s.h, 0);
      const shaft = new THREE.CylinderGeometry(s.r, s.r, s.h, 16);
      shaft.translate(0, s.h / 2, 0);
      g = shaft; // keep it light: shaft + head drawn as two meshes via merge below
      const merged = new THREE.BufferGeometry();
      const a = head.toNonIndexed(), c = shaft.toNonIndexed();
      const pos = new Float32Array(a.attributes.position.array.length + c.attributes.position.array.length);
      pos.set(a.attributes.position.array as Float32Array);
      pos.set(c.attributes.position.array as Float32Array, a.attributes.position.array.length);
      merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      merged.computeVertexNormals();
      g = merged;
      break;
    }
    case "screen":
      g = new THREE.PlaneGeometry(s.w, s.d);
      g.rotateX(-Math.PI / 2);
      break;
  }
  cache.set(key, g);
  return g;
}

/** E-ink style readout for the air monitor, painted on a canvas. */
export function screenTexture(kind: "air" | "off") {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 400;
  const x = c.getContext("2d")!;
  if (kind === "off") {
    x.fillStyle = "#101418";
    x.fillRect(0, 0, c.width, c.height);
  } else {
    x.fillStyle = "#d9dcd6";
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#1b1d1f";
    x.font = "600 120px Helvetica, Arial, sans-serif";
    x.fillText("612", 40, 180);
    x.font = "500 34px Helvetica, Arial, sans-serif";
    x.fillText("ppm CO₂", 300, 120);
    x.fillStyle = "#3d7b4f";
    x.fillText("● good", 300, 170);
    x.fillStyle = "#1b1d1f";
    x.fillRect(40, 220, 560, 3);
    x.font = "500 52px Helvetica, Arial, sans-serif";
    x.fillText("21.4°", 40, 300);
    x.fillText("48%", 250, 300);
    x.fillText("1013", 430, 300);
    x.font = "400 24px Helvetica, Arial, sans-serif";
    x.fillStyle = "#55595c";
    x.fillText("TEMP", 40, 340);
    x.fillText("HUMIDITY", 250, 340);
    x.fillText("hPa", 430, 340);
    // sparkline
    x.strokeStyle = "#1b1d1f";
    x.lineWidth = 3;
    x.beginPath();
    for (let i = 0; i <= 40; i++) {
      const px = 40 + i * 14, py = 380 - 14 * Math.sin(i / 4) - i * 0.4;
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------- concept products ---------- */

export interface ProductPart {
  id: string;
  name?: string; // label when pulled apart
  shape: Shape;
  mat: MatName | "screen";
  pos: [number, number, number];
  rot?: [number, number, number];
  dir: [number, number, number];
  distance: number;
}

export interface Product {
  id: string;
  name: string;
  short: string;
  line: string;
  facts: string[];
  board: { spec: BoardSpec; pos: [number, number, number]; dir: [number, number, number]; distance: number };
  parts: ProductPart[];
  view: { az: number; el: number; d: number; openEl: number; openD: number; target: [number, number, number] };
}

const corners = (x: number, z: number): [number, number][] => [
  [-x, -z],
  [x, -z],
  [-x, z],
  [x, z],
];

export const PRODUCTS: Product[] = [
  {
    id: "air-monitor",
    name: "Air monitor",
    short: "Air monitor",
    line: "A desk monitor for CO₂, temperature and humidity, with a paper-like screen you can read from across the room.",
    facts: ["E-ink display", "2000 mAh cell", "Wi-Fi"],
    board: { spec: AIR_BOARD, pos: [0, 13, 0], dir: [0, 1, 0], distance: 6 },
    parts: [
      { id: "base", name: "Base", shape: { kind: "box", w: 84, d: 84, h: 9, r: 12 }, mat: "abs-white", pos: [0, 0, 0], dir: [0, -1, 0], distance: 34 },
      { id: "feet", shape: { kind: "cyl", r: 34, h: 1 }, mat: "rubber", pos: [0, -1, 0], dir: [0, -1, 0], distance: 40 },
      ...corners(34, 34).map(([x, z], i) => ({ id: `screw${i}`, shape: { kind: "screw", r: 1.1, h: 9 } as Shape, mat: "steel" as const, pos: [x, 8.5, z] as [number, number, number], rot: [Math.PI, 0, 0] as [number, number, number], dir: [0, -1, 0] as [number, number, number], distance: 48 })),
      { id: "cell", name: "2000 mAh cell", shape: { kind: "box", w: 52, d: 34, h: 5, r: 2, bevel: 0.8 }, mat: "pouch", pos: [0, 9.5, 2], dir: [0, -1, 0], distance: 18 },
      { id: "top", name: "Top shell", shape: { kind: "box", w: 84, d: 84, h: 18, r: 12 }, mat: "abs-white", pos: [0, 15.5, 0], dir: [0, 1, 0], distance: 34 },
      { id: "glass", name: "E-ink display", shape: { kind: "screen", w: 52, d: 32.5, screen: "air" }, mat: "screen", pos: [0, 34.15, -4], dir: [0, 1, 0], distance: 54 },
      { id: "bezel", shape: { kind: "box", w: 58, d: 38.5, h: 0.6, r: 3, bevel: 0.25 }, mat: "glass-cover", pos: [0, 33.4, -4], dir: [0, 1, 0], distance: 52 },
      { id: "pipe", name: "Status light", shape: { kind: "cyl", r: 1.6, h: 0.8 }, mat: "light-pipe", pos: [0, 33.4, 27], dir: [0, 1, 0], distance: 44 },
    ],
    view: { az: -26, el: 30, d: 260, openEl: 16, openD: 330, target: [0, 18, 0] },
  },
  {
    id: "remote",
    name: "Scene remote",
    short: "Scene remote",
    line: "One big press-and-turn button for lights and music, on a coin cell that lasts a year.",
    facts: ["Bluetooth LE", "CR2032 cell"],
    board: { spec: REMOTE_BOARD, pos: [0, 7.5, 0], dir: [0, 1, 0], distance: 4 },
    parts: [
      { id: "back", name: "Back shell", shape: { kind: "box", w: 44, d: 64, h: 6.5, r: 10 }, mat: "tpe-soft", pos: [0, 0, 0], dir: [0, -1, 0], distance: 26 },
      { id: "cell", name: "CR2032 cell", shape: { kind: "cyl", r: 10, h: 3.2 }, mat: "steel", pos: [0, 3.6, -8], dir: [0, -1, 0], distance: 13 },
      { id: "top", name: "Top shell", shape: { kind: "box", w: 44, d: 64, h: 7, r: 10 }, mat: "tpe-soft", pos: [0, 9.6, 0], dir: [0, 1, 0], distance: 24 },
      { id: "knob", name: "Press-and-turn button", shape: { kind: "cyl", r: 11, h: 4.5 }, mat: "silicone", pos: [0, 16.4, 10], dir: [0, 1, 0], distance: 42 },
      { id: "ring", name: "Light ring", shape: { kind: "torus", r: 12.4, tube: 0.55 }, mat: "light-pipe", pos: [0, 16.7, 10], dir: [0, 1, 0], distance: 34 },
      ...corners(14, 24).map(([x, z], i) => ({ id: `screw${i}`, shape: { kind: "screw", r: 0.9, h: 6 } as Shape, mat: "steel" as const, pos: [x, 5.5, z] as [number, number, number], rot: [Math.PI, 0, 0] as [number, number, number], dir: [0, -1, 0] as [number, number, number], distance: 38 })),
    ],
    view: { az: -30, el: 34, d: 175, openEl: 18, openD: 230, target: [0, 9, 0] },
  },
  {
    id: "tag",
    name: "Find-me tag",
    short: "Find-me tag",
    line: "A key-ring tag that beeps when you look for it and glows when you leave it behind.",
    facts: ["Bluetooth LE", "Buzzer", "Two-year battery"],
    board: { spec: TAG_BOARD, pos: [0, 6.5, 0], dir: [0, 1, 0], distance: 3 },
    parts: [
      { id: "base", name: "Base", shape: { kind: "cyl", r: 20, h: 4.6 }, mat: "anodised-black", pos: [0, 0, 0], dir: [0, -1, 0], distance: 20 },
      { id: "cell", name: "CR2032 cell", shape: { kind: "cyl", r: 10, h: 3.2 }, mat: "steel", pos: [0, 2.6, 0], dir: [0, -1, 0], distance: 10 },
      { id: "band", name: "Metal band", shape: { kind: "cyl", r: 20.2, h: 2.4 }, mat: "gold", pos: [0, 4.6, 0], dir: [0, 1, 0], distance: 10 },
      { id: "glow", name: "Glow ring", shape: { kind: "torus", r: 19.2, tube: 0.5 }, mat: "light-pipe", pos: [0, 7.2, 0], dir: [0, 1, 0], distance: 16 },
      { id: "dome", name: "Dome", shape: { kind: "dome", r: 20, h: 7.5 }, mat: "abs-white-gloss", pos: [0, 7, 0], dir: [0, 1, 0], distance: 26 },
    ],
    view: { az: -24, el: 32, d: 140, openEl: 14, openD: 190, target: [0, 7, 0] },
  },
];
