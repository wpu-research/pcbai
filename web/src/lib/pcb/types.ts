// KiCad-style coordinates: millimetres, x right, y down. Three.js maps (x, y) -> (x, ·, y).

export type PadShape = "rect" | "roundrect" | "oval" | "circle";

export interface Pad {
  number: string;
  kind: "smd" | "tht" | "npth";
  shape: PadShape;
  x: number;
  y: number;
  rotation: number;
  w: number;
  h: number;
  drill?: { w: number; h: number };
  layers: string[];
}

export type Graphic =
  | { kind: "line"; layer: string; x1: number; y1: number; x2: number; y2: number; width: number }
  | { kind: "arc"; layer: string; x1?: number; y1?: number; x2?: number; y2?: number; cx?: number; cy?: number; start?: [number, number]; mid?: [number, number]; end?: [number, number]; width: number }
  | { kind: "circle"; layer: string; cx: number; cy: number; r?: number; ex?: number; ey?: number; width: number }
  | { kind: "rect"; layer: string; x1: number; y1: number; x2: number; y2: number; width: number }
  | { kind: "poly"; layer: string; points: [number, number][]; width: number }
  | { kind: "text"; layer: string; text: string; x: number; y: number };

export interface Footprint {
  id: string;
  name: string;
  pads: Pad[];
  graphics: Graphic[];
  bbox: [number, number, number, number];
  model?: { id: string; offset?: number[]; rotate?: number[]; scale?: number[] };
}

export interface PartSpec {
  ref: string;
  footprint: string; // file key under /library/footprints and /library/models
  x: number;
  y: number;
  rot: number; // degrees, clockwise on screen (KiCad y-down)
  name: string; // short human name for labels
  does?: string;
  group: string; // functional block
  label?: boolean; // show a lead label in the hero
}

export interface NetSpec {
  name: string;
  kind: "power" | "ground" | "signal" | "usb";
  width: number;
  pins: [string, string][]; // [ref, pad number]
}

export interface BoardSpec {
  id: string;
  title: string;
  width: number;
  height: number;
  radius: number;
  thickness: number;
  holes: { x: number; y: number; d: number }[];
  parts: PartSpec[];
  nets: NetSpec[];
  finish: { mask: MaskName; silk: "white" | "black"; surface: "enig" | "hasl" };
}

export type MaskName = "green" | "black" | "blue" | "red" | "white" | "purple";

export interface Trace {
  net: string;
  kind: NetSpec["kind"];
  width: number;
  points: [number, number][];
}
