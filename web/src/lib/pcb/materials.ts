import * as THREE from "three";
import type { BoardSpec, MaskName } from "./types";

export const MASKS: Record<MaskName, { three: string; trace: string }> = {
  green: { three: "#1e5a40", trace: "#377156" },
  black: { three: "#1d1f1e", trace: "#44413a" },
  blue: { three: "#1e3f70", trace: "#335588" },
  red: { three: "#7a1f24", trace: "#943839" },
  white: { three: "#e9e8e3", trace: "#d5d4cf" },
  purple: { three: "#4a2f68", trace: "#604580" },
};
export const SILKS = { white: "#f1efe8", black: "#24231f" };
export const SURFACES = { enig: "#d6b46c", hasl: "#c9cccf" };
export const COPPER = "#b87333";
export const FR4_CORE = "#21241e";
export const FR4_EDGE = "#8f7f5a";
export const FR4_CORE_EDGE = "#413b2c";
export const SELECT = "#7ed0dd";
export const EDGE_LINE = "#d3c39c";

export type BoardMaterials = ReturnType<typeof boardMaterials>;

export function boardMaterials(finish: BoardSpec["finish"]) {
  const black = finish.mask === "black";
  const enig = finish.surface === "enig";
  const mask = MASKS[finish.mask];
  const top = new THREE.MeshPhysicalMaterial({
    color: mask.three,
    roughness: black ? 0.36 : 0.52,
    clearcoat: 0.6,
    clearcoatRoughness: black ? 0.3 : 0.36,
    envMapIntensity: black ? 0.3 : 0.55,
    transparent: true,
  });
  const side = new THREE.MeshStandardMaterial({ color: FR4_EDGE, roughness: 0.9, envMapIntensity: 0.4, transparent: true });
  const trace = new THREE.MeshPhysicalMaterial({
    color: mask.trace,
    roughness: 0.36,
    clearcoat: 0.8,
    clearcoatRoughness: 0.24,
    envMapIntensity: 1.6,
    emissive: COPPER,
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    transparent: true,
  });
  const pad = new THREE.MeshStandardMaterial({
    color: SURFACES[finish.surface],
    metalness: 1,
    roughness: enig ? 0.25 : 0.34,
    envMapIntensity: 1.15,
    emissive: SURFACES[finish.surface],
    emissiveIntensity: enig ? 0.035 : 0.02,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    transparent: true,
  });
  const silk = new THREE.MeshStandardMaterial({
    color: SILKS[finish.silk],
    roughness: 0.85,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    transparent: true,
  });
  const hole = new THREE.MeshStandardMaterial({ color: "#070708", roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const maskSheet = new THREE.MeshPhysicalMaterial({
    color: black ? "#16181a" : mask.three,
    transparent: true,
    opacity: 0,
    alphaTest: 0.5,
    roughness: 0.45,
    clearcoat: 0.3,
    clearcoatRoughness: 0.45,
    specularIntensity: 0.6,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const bottomCopper = new THREE.MeshStandardMaterial({
    color: COPPER,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.2,
    emissive: COPPER,
    emissiveIntensity: 0.04,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const edge = new THREE.MeshBasicMaterial({ color: EDGE_LINE, transparent: true, depthWrite: false, toneMapped: false });
  const airwire = new THREE.LineBasicMaterial({ color: "#eceae5", transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const select = new THREE.MeshBasicMaterial({ color: new THREE.Color(SELECT).multiplyScalar(1.5), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const selectThrough = new THREE.MeshBasicMaterial({ color: SELECT, transparent: true, opacity: 0.35, depthTest: false, toneMapped: false });
  return { top, side, trace, pad, silk, hole, maskSheet, bottomCopper, edge, airwire, select, selectThrough, maskColor: new THREE.Color(mask.three), traceColor: new THREE.Color(mask.trace) };
}

const _a = new THREE.Color(), _b = new THREE.Color();
const CORE = new THREE.Color(FR4_CORE), COPPER_C = new THREE.Color(COPPER), EDGE_A = new THREE.Color(FR4_EDGE), EDGE_B = new THREE.Color(FR4_CORE_EDGE);

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const linear = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const ramp = (x: number, a: number, b: number) => smooth(linear(x, a, b));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Morph the mask-covered board into bare layers while it explodes. */
export function applyExplode(m: BoardMaterials, e: number, finishBlack: boolean) {
  const E = ramp(e, 0.35, 0.8);
  m.top.color.copy(_a.copy(m.maskColor).lerp(CORE, E));
  m.top.roughness = THREE.MathUtils.lerp(finishBlack ? 0.36 : 0.52, 0.82, E);
  m.top.clearcoat = THREE.MathUtils.lerp(0.6, 0.02, E);
  m.side.color.copy(_b.copy(EDGE_A).lerp(EDGE_B, E));
  m.trace.color.copy(_a.copy(m.traceColor).lerp(COPPER_C, E));
  m.trace.metalness = E;
  m.trace.roughness = THREE.MathUtils.lerp(0.36, 0.3, E);
  m.trace.clearcoat = THREE.MathUtils.lerp(0.8, 0.2, E);
  m.trace.envMapIntensity = THREE.MathUtils.lerp(1.6, 1.2, E);
  m.trace.emissiveIntensity = 0.04 * ramp(e, 0.8, 1);
  m.maskSheet.opacity = ramp(e, 0, 0.1) * THREE.MathUtils.lerp(0.95, 0.9, ramp(e, 0.4, 0.9));
  m.maskSheet.visible = e > 0.002;
}

/** Sort the colours of a KiCad GLB into metal leads, gold, or plastic. */
export function tunePartMaterial(mat: THREE.MeshStandardMaterial) {
  const c = mat.color;
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const chroma = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  if (lum > 0.22 && chroma < 0.1) Object.assign(mat, { metalness: 0.9, roughness: 0.32, envMapIntensity: 1.1 });
  else if (c.r > 1.8 * c.b && c.g > 1.2 * c.b && lum > 0.15) Object.assign(mat, { metalness: 1, roughness: 0.26, envMapIntensity: 1.1 });
  else Object.assign(mat, { metalness: 0, roughness: 0.48, envMapIntensity: 0.9 });
}
