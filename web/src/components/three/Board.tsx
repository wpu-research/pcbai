"use client";

import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  boardCoreGeometry,
  boardOutline,
  fillShape,
  layerCanvas,
  loadFootprints,
  padsOf,
  partDrillGeometry,
  partPadGeometry,
  partSilkGeometry,
  ribbon,
  ringGeometry,
  routeBoard,
} from "@/lib/pcb/geometry";
import { applyExplode, boardMaterials, damp, easeInOutCubic, easeOutCubic, linear, ramp, SELECT } from "@/lib/pcb/materials";
import type { BoardSpec, Footprint, PartSpec } from "@/lib/pcb/types";
import { isProcedural } from "@/lib/pcb/procedural";
import { useHeaderObject, usePartObject } from "./PartModel";

export interface Timeline {
  outline: number;
  airwires: number;
  assemble: number;
  traces: number;
  check: number;
  explode: number;
  gather: number; // parts float above the board before placement
  hop: number; // seconds since the settle-hop started, < 0 = off
}

export const DONE: Timeline = { outline: 1, airwires: 1, assemble: 1, traces: 1, check: 0, explode: 0, gather: 0, hop: -1 };
export const EMPTY: Timeline = { outline: 0, airwires: 0, assemble: 0, traces: 0, check: 0, explode: 0, gather: 0, hop: -1 };

/** Layer heights (mm) at explode = 1. */
export const LIFT = { bottom: 9, copper: 14, mask: 24, silk: 34, parts: 43 };

export const LAYERS = [
  { id: "parts", name: "Parts", file: "bom.csv · cpl.csv", y: (e: number) => e * LIFT.parts + 4 },
  { id: "silk", name: "Silkscreen", file: "F_Silkscreen.gbr", y: (e: number) => 0.05 + e * LIFT.silk },
  { id: "mask", name: "Solder mask", file: "F_Mask.gbr", y: (e: number) => 0.045 + e * LIFT.mask },
  { id: "copper", name: "Top copper", file: "F_Cu.gbr", y: (e: number) => 0.03 + e * LIFT.copper },
  { id: "core", name: "Fibreglass core", file: "Edge_Cuts.gbr", y: () => -0.8 },
  { id: "bottom", name: "Bottom copper", file: "B_Cu.gbr", y: (e: number) => -1.63 - e * LIFT.bottom },
] as const;

interface BuiltBoard {
  fps: Map<string, Footprint>;
  core: THREE.BufferGeometry;
  outline: THREE.BufferGeometry;
  pads: Map<string, THREE.BufferGeometry>;
  drills: THREE.BufferGeometry | null;
  silk: THREE.BufferGeometry | null;
  traces: THREE.BufferGeometry | null;
  vias: THREE.BufferGeometry | null;
  viaHoles: THREE.BufferGeometry | null;
  rings: THREE.BufferGeometry;
  ringHoles: THREE.BufferGeometry;
  airwires: THREE.BufferGeometry;
  mask: THREE.Texture;
  bottom: THREE.Texture;
}

const boardCache = new Map<string, Promise<BuiltBoard>>();

function build(spec: BoardSpec): Promise<BuiltBoard> {
  let p = boardCache.get(spec.id);
  if (p) return p;
  p = loadFootprints(spec).then((fps) => {
    const pads = new Map<string, THREE.BufferGeometry>();
    const silk: THREE.BufferGeometry[] = [];
    const drills: THREE.BufferGeometry[] = [];
    for (const part of spec.parts) {
      const fp = fps.get(part.footprint)!;
      const g = partPadGeometry(fp, part, 0);
      if (g) pads.set(part.ref, g);
      const s = partSilkGeometry(fp, part, 0);
      if (s) silk.push(s);
      const d = partDrillGeometry(fp, part, 0.004);
      if (d) drills.push(d);
    }
    const routed = routeBoard(spec, fps);
    const traceGeos = routed.traces.map((t) => ribbon(t.points, t.width, -0.004));
    const viaGeos = routed.vias.map(([x, y]) => ringGeometry(x, y, 0.2, 0.45, 0.001));
    const viaHoleGeos = routed.vias.map(([x, y]) => ringGeometry(x, y, 0, 0.2, 0.003));
    const rings = mergeGeometries(spec.holes.map((h) => ringGeometry(h.x, h.y, h.d / 2, h.d / 2 + 1.3, 0)));
    const ringHoles = mergeGeometries(spec.holes.map((h) => ringGeometry(h.x, h.y, 0, h.d / 2, 0.01)));

    const aw: number[] = [];
    for (const [a, b] of routed.airwires) aw.push(a[0], 0.07, a[1], b[0], 0.07, b[1]);
    const airwires = new THREE.BufferGeometry();
    airwires.setAttribute("position", new THREE.Float32BufferAttribute(aw, 3));

    const mask = layerCanvas(spec, (ctx, k) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "#000";
      for (const part of spec.parts) for (const pad of padsOf(fps.get(part.footprint)!)) fillShape(ctx, k, part, pad, 0.1);
      for (const [x, y] of routed.vias) {
        ctx.beginPath();
        ctx.arc(x * k, y * k, 0.45 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const h of spec.holes) {
        ctx.beginPath();
        ctx.arc(h.x * k, h.y * k, (h.d / 2 + 1.3) * k, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const bottom = layerCanvas(spec, (ctx, k) => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(0.5 * k, 0.5 * k, (spec.width - 1) * k, (spec.height - 1) * k, spec.radius * k);
      ctx.fill();
      ctx.fillStyle = "#000";
      for (const h of spec.holes) {
        ctx.beginPath();
        ctx.arc(h.x * k, h.y * k, (h.d / 2 + 0.6) * k, 0, Math.PI * 2);
        ctx.fill();
      }
      // thermal-relief style gaps around ground vias and a couple of bottom-side signal cuts
      for (const [x, y] of routed.vias) {
        ctx.beginPath();
        ctx.arc(x * k, y * k, 0.75 * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect((x - 0.15) * k, (y - 0.9) * k, 0.3 * k, 1.8 * k);
        ctx.fillRect((x - 0.9) * k, (y - 0.15) * k, 1.8 * k, 0.3 * k);
        ctx.beginPath();
        ctx.arc(x * k, y * k, 0.45 * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(x * k, y * k, 0.2 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      // the antenna keeps its copper-free zone
      const u1 = spec.parts.find((p) => p.footprint.includes("ESP32"));
      if (u1) ctx.fillRect((u1.x + 7.1) * k, (u1.y - 14) * k, 12 * k, 28 * k);
    });

    return {
      fps,
      core: boardCoreGeometry(spec),
      outline: ribbon(boardOutline(spec), 0.3, 0.02, false),
      pads,
      drills: drills.length ? mergeGeometries(drills) : null,
      silk: silk.length ? mergeGeometries(silk) : null,
      traces: traceGeos.length ? mergeGeometries(traceGeos) : null,
      vias: viaGeos.length ? mergeGeometries(viaGeos) : null,
      viaHoles: viaHoleGeos.length ? mergeGeometries(viaHoleGeos) : null,
      rings,
      ringHoles,
      airwires,
      mask,
      bottom,
    };
  });
  boardCache.set(spec.id, p);
  return p;
}

export function useBuiltBoard(spec: BoardSpec) {
  const [b, setB] = useState<BuiltBoard | null>(null);
  useEffect(() => {
    let live = true;
    build(spec).then((x) => live && setB(x)).catch((e) => console.warn("[3d] board build failed", e));
    return () => {
      live = false;
    };
  }, [spec]);
  return b;
}

/* ---------- one placed part ---------- */

interface PartState {
  group: THREE.Group | null;
  mats: THREE.MeshStandardMaterial[];
  base: THREE.Color[];
  top: number;
  glow: number;
  dim: number;
}

function Part({ part, fp, lo, state }: { part: PartSpec; fp: Footprint; lo: boolean; state: PartState }) {
  return isProcedural(part.footprint) ? <HeaderPart fp={fp} state={state} /> : <LibraryPart part={part} fp={fp} lo={lo} state={state} />;
}

function HeaderPart({ fp, state }: { fp: Footprint; state: PartState }) {
  const { object, mats, base, top } = useHeaderObject(fp);
  useEffect(() => {
    state.mats = mats;
    state.base = base;
    state.top = top;
  }, [state, mats, base, top]);
  return <primitive object={object} />;
}

function LibraryPart({ part, fp, lo, state }: { part: PartSpec; fp: Footprint; lo: boolean; state: PartState }) {
  const { object, mats, base, top } = usePartObject(part.footprint, fp, lo);
  useEffect(() => {
    state.mats = mats;
    state.base = base;
    state.top = top;
  }, [state, mats, base, top]);
  return <primitive object={object} />;
}

function Slab({ fp }: { fp: Footprint }) {
  const [x0, y0, x1, y1] = fp.bbox;
  return (
    <mesh position={[(x0 + x1) / 2, 0.6, (y0 + y1) / 2]} castShadow>
      <boxGeometry args={[Math.max(0.4, (x1 - x0) * 0.7), 1.2, Math.max(0.4, (y1 - y0) * 0.7)]} />
      <meshStandardMaterial color="#2a2c30" roughness={0.6} />
    </mesh>
  );
}

/** A part whose 3D model is missing or fails to load is drawn as a plain body; the board carries on. */
class PartBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ---------- the board ---------- */

export interface BoardProps {
  spec: BoardSpec;
  tl: RefObject<Timeline>;
  lo?: boolean;
  hovered?: RefObject<string | null>;
  onHover?: (ref: string | null) => void;
  anchors?: RefObject<Map<string, THREE.Vector3>>;
  onReady?: () => void;
  dropHeight?: number; // how far parts fall when placed
  bare?: boolean; // pads and silk visible from the start (fabricated, unpopulated board)
}

export function Board({ spec, tl, lo = false, hovered, onHover, anchors, onReady, dropHeight = 30, bare = false }: BoardProps) {
  const built = useBuiltBoard(spec);
  const mats = useMemo(() => boardMaterials(spec.finish), [spec.finish]);
  const black = spec.finish.mask === "black";
  const n = spec.parts.length;

  const states = useMemo(
    () => new Map<string, PartState>(spec.parts.map((p) => [p.ref, { group: null, mats: [], base: [], top: 2, glow: 0, dim: 0 }])),
    [spec.parts],
  );

  const g = {
    copper: useRef<THREE.Group>(null),
    silk: useRef<THREE.Group>(null),
    mask: useRef<THREE.Mesh>(null),
    bottom: useRef<THREE.Mesh>(null),
    parts: useRef<THREE.Group>(null),
    traces: useRef<THREE.Mesh>(null),
    outline: useRef<THREE.Mesh>(null),
    airwires: useRef<THREE.LineSegments>(null),
    sweep: useRef<THREE.Mesh>(null),
    selPads: useRef<THREE.Group>(null),
  };

  const sweepMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(SELECT).multiplyScalar(1.9) }, uOpacity: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
          void main(){ float x = abs(vUv.x - 0.5) * 2.0;
            float light = 0.65*exp(-x*x*3.0) + 0.35*exp(-x*x*40.0);
            float ends = smoothstep(0.0,0.07,vUv.y) * smoothstep(0.0,0.07,1.0-vUv.y);
            gl_FragColor = vec4(uColor, light*ends*uOpacity); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useEffect(() => {
    if (built) onReady?.();
  }, [built, onReady]);

  useFrame((_, dtRaw) => {
    if (!built) return;
    const dt = Math.min(dtRaw, 1 / 30);
    const t = tl.current!;
    const e = t.explode;
    applyExplode(mats, e, black);

    // outline draws on, then the slab fades in
    const outlineCount = built.outline.getAttribute("position").count;
    built.outline.setDrawRange(0, Math.floor((easeInOutCubic(linear(t.outline, 0, 0.55)) * outlineCount) / 3) * 3);
    const slab = easeOutCubic(linear(t.outline, 0.3, 0.9));
    mats.top.opacity = mats.side.opacity = slab;
    mats.edge.opacity = THREE.MathUtils.lerp(1, 0.0, ramp(t.assemble, 0.0, 0.4)) * (t.outline > 0 ? 1 : 0);

    // layers
    if (g.copper.current) g.copper.current.position.y = 0.03 + e * LIFT.copper;
    if (g.silk.current) g.silk.current.position.y = 0.05 + e * LIFT.silk;
    if (g.mask.current) g.mask.current.position.y = 0.045 + e * LIFT.mask;
    if (g.bottom.current) {
      g.bottom.current.position.y = -spec.thickness - 0.03 - e * LIFT.bottom;
      (g.bottom.current.material as THREE.Material).opacity = 1;
      g.bottom.current.visible = e > 0.002;
    }
    if (g.parts.current) g.parts.current.position.y = e * LIFT.parts;
    const dressed = slab * Math.max(bare ? 1 : 0, ramp(t.gather, 0, 0.25), ramp(t.assemble, 0, 0.15), e > 0 ? 1 : 0);
    mats.silk.opacity = dressed;
    mats.pad.opacity = dressed;
    mats.pad.visible = mats.silk.visible = dressed > 0.002;

    // traces draw progressively
    if (built.traces && g.traces.current) {
      const count = built.traces.getAttribute("position").count;
      built.traces.setDrawRange(0, Math.floor((easeOutCubic(t.traces) * count) / 3) * 3);
      g.traces.current.visible = t.traces > 0;
    }

    // airwires
    mats.airwire.opacity = 0.6 * ramp(t.airwires, 0, 0.4) * (1 - ramp(t.traces, 0.2, 0.9)) * (1 - e);
    if (g.airwires.current) g.airwires.current.visible = mats.airwire.opacity > 0.005;

    // DRC sweep
    if (g.sweep.current) {
      const u = t.check;
      g.sweep.current.position.x = THREE.MathUtils.lerp(-2, spec.width + 2, easeInOutCubic(u));
      sweepMat.uniforms.uOpacity.value = ramp(u, 0.04, 0.16) * (1 - ramp(u, 0.8, 0.92));
      g.sweep.current.visible = sweepMat.uniforms.uOpacity.value > 0.003;
    }

    // parts: drop in, hop, highlight
    const span = 0.34;
    const hov = hovered?.current ?? null;
    let i = 0;
    for (const part of spec.parts) {
      const s = states.get(part.ref)!;
      const start = n > 1 ? (i / (n - 1)) * (1 - span) : 0;
      const u = linear(t.assemble, start, start + span);
      const gs = n > 1 ? (i / (n - 1)) * (1 - 0.42) : 0;
      const gv = easeOutCubic(linear(t.gather, gs, gs + 0.42));
      let y = 0.06 + (1 - easeOutCubic(u)) * (dropHeight === 30 ? 22 + 8 * (1 - gv) : dropHeight);
      if (t.hop >= 0) {
        const h = t.hop - (i / n) * 0.7;
        if (h > 0 && h < 2) y += h < 0.4 ? 8 * easeOutCubic(h / 0.4) : 8 * (1 - easeInOutCubic((h - 0.4) / 1.6));
      }
      if (s.group) {
        s.group.position.y = y;
        s.group.visible = u > 0 || gv > 0;
      }
      const op = Math.max(easeOutCubic(Math.min(1, 2.5 * u)), gv);
      s.glow = damp(s.glow, hov === part.ref ? 1 : 0, 12, dt);
      s.dim = damp(s.dim, hov && hov !== part.ref ? 1 : 0, 12, dt);
      for (let k = 0; k < s.mats.length; k++) {
        const m = s.mats[k];
        m.opacity = op;
        m.color.copy(s.base[k]).multiplyScalar(1 - 0.3 * s.dim);
        m.emissive.set(SELECT);
        m.emissiveIntensity = 0.16 * s.glow;
      }
      if (anchors?.current && s.group) {
        const a = anchors.current.get(part.ref) ?? new THREE.Vector3();
        a.set(part.x, y + s.top + 0.4 + e * LIFT.parts, part.y);
        anchors.current.set(part.ref, a);
      }
      i++;
    }
    if (g.selPads.current) {
      for (const c of g.selPads.current.children) c.visible = c.name === hov;
    }
  });

  if (!built) return null;
  const w = spec.width, h = spec.height;

  return (
    <group position={[-w / 2, 0, -h / 2]}>
      {/* FR-4 core with solder mask on top */}
      <mesh geometry={built.core} material={[mats.top, mats.side]} castShadow receiveShadow />
      <mesh geometry={built.ringHoles} material={mats.hole} />
      <mesh geometry={built.outline} material={mats.edge} renderOrder={2} />

      {/* top copper: pads, traces, vias, mounting rings */}
      <group ref={g.copper}>
        {[...built.pads.entries()].map(([ref, geo]) => (
          <mesh
            key={ref}
            geometry={geo}
            material={mats.pad}
            receiveShadow
            onPointerOver={(ev) => {
              ev.stopPropagation();
              onHover?.(ref);
            }}
            onPointerOut={() => onHover?.(null)}
          />
        ))}
        <group ref={g.selPads}>
          {[...built.pads.entries()].map(([ref, geo]) => (
            <group key={ref} name={ref} visible={false}>
              <mesh geometry={geo} material={mats.select} position-y={0.012} renderOrder={4} />
              <mesh geometry={geo} material={mats.selectThrough} position-y={0.012} renderOrder={10} />
            </group>
          ))}
        </group>
        {built.traces && <mesh ref={g.traces} geometry={built.traces} material={mats.trace} receiveShadow />}
        {built.vias && <mesh geometry={built.vias} material={mats.pad} />}
        {built.viaHoles && <mesh geometry={built.viaHoles} material={mats.hole} />}
        <mesh geometry={built.rings} material={mats.pad} receiveShadow />
        {built.drills && <mesh geometry={built.drills} material={mats.hole} />}
      </group>

      {/* silkscreen */}
      <group ref={g.silk}>{built.silk && <mesh geometry={built.silk} material={mats.silk} />}</group>

      {/* solder-mask sheet, only visible while exploded */}
      <mesh ref={g.mask} position={[w / 2, 0.045, h / 2]} rotation-x={-Math.PI / 2} visible={false}>
        <planeGeometry args={[w, h]} />
        <primitive object={mats.maskSheet} attach="material" alphaMap={built.mask} />
      </mesh>

      {/* bottom copper pour */}
      <mesh ref={g.bottom} position={[w / 2, -spec.thickness - 0.03, h / 2]} rotation-x={-Math.PI / 2} visible={false}>
        <planeGeometry args={[w, h]} />
        <primitive object={mats.bottomCopper} attach="material" alphaMap={built.bottom} />
      </mesh>

      {/* ratsnest */}
      <lineSegments ref={g.airwires} geometry={built.airwires} material={mats.airwire} />

      {/* DRC sweep band */}
      <mesh ref={g.sweep} position={[0, 3, h / 2]} rotation-y={Math.PI / 2} material={sweepMat} visible={false}>
        <planeGeometry args={[h + 4, 6]} />
      </mesh>

      {/* parts */}
      <group ref={g.parts}>
        {spec.parts.map((part) => {
          const fp = built.fps.get(part.footprint)!;
          const s = states.get(part.ref)!;
          return (
            <group
              key={part.ref}
              name={`part:${part.ref}`}
              ref={(o) => {
                s.group = o;
              }}
              position={[part.x, 0.06, part.y]}
              rotation-y={-THREE.MathUtils.degToRad(part.rot)}
              onPointerOver={(ev) => {
                ev.stopPropagation();
                onHover?.(part.ref);
              }}
              onPointerOut={() => onHover?.(null)}
            >
              <PartBoundary fallback={<Slab fp={fp} />}>
                <Suspense fallback={<Slab fp={fp} />}>
                  <Part part={part} fp={fp} lo={lo} state={s} />
                </Suspense>
              </PartBoundary>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** Canvas-blurred silhouette under the board (cheaper and softer than contact shadows). */
export function BoardShadow({ spec, y = -8, opacity = 0.5, blur = 7, tl }: { spec: BoardSpec; y?: number; opacity?: number; blur?: number; tl?: RefObject<Timeline> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { tex, w, h } = useMemo(() => {
    const k = 6, pad = 14;
    const w = spec.width + pad * 2, h = spec.height + pad * 2;
    const c = document.createElement("canvas");
    c.width = w * k;
    c.height = h * k;
    const ctx = c.getContext("2d")!;
    const off = c.width * 2;
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowBlur = 6 * blur;
    ctx.shadowOffsetX = off;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(pad * k - off, pad * k, spec.width * k, spec.height * k, spec.radius * k);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    return { tex, w, h };
  }, [spec, blur]);
  useFrame(() => {
    if (!mesh.current) return;
    const t = tl?.current;
    const k = t ? easeOutCubic(linear(t.outline, 0.3, 0.9)) * (1 - 0.6 * t.explode) : 1;
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = opacity * k;
  });
  return (
    <mesh ref={mesh} position={[0, y, 0]} rotation-x={-Math.PI / 2} renderOrder={-1}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
