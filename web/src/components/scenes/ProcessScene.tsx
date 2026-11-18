"use client";

import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { FIELD_NODE } from "@/lib/pcb/boards";
import { damp, easeInOutCubic, linear, ramp } from "@/lib/pcb/materials";
import { Board, BoardShadow, EMPTY, LAYERS, type Timeline } from "../three/Board";
import { LeadProjector, Leads, type LeadItem } from "../three/Leads";
import { isCompact } from "../three/Stage";
import { Studio } from "../three/Studio";
import { newTurn, TurnCamera, type Turn } from "../three/turntable";

/** Stage windows on the 0..1 scroll track. */
export const BOUNDS = [0, 0.13, 0.27, 0.41, 0.55, 0.69, 0.83, 1];

type View3 = { az: number; el: number; d: number; t: [number, number, number] };
const VIEWS: View3[] = [
  { az: -6, el: 64, d: 118, t: [0, 0, 3] }, // brief: the outline from above
  { az: -28, el: 30, d: 128, t: [0, 12, 0] }, // parts in the air
  { az: -14, el: 48, d: 120, t: [0, 6, 0] }, // ratsnest
  { az: -30, el: 36, d: 106, t: [0, 2, 0] }, // placed
  { az: -12, el: 58, d: 96, t: [0, 0, 3] }, // routed
  { az: 4, el: 42, d: 98, t: [0, -1, 3] }, // checked
  { az: -24, el: 15, d: 150, t: [16, 12, 0] }, // exploded
];

function stageAt(p: number) {
  for (let i = 0; i < BOUNDS.length - 1; i++) if (p < BOUNDS[i + 1]) return i;
  return BOUNDS.length - 2;
}

/** Map scroll progress to the board timeline. */
function timelineAt(p: number, t: Timeline) {
  const S = (i: number, a = 0.15, b = 0.85) => linear(p, BOUNDS[i] + (BOUNDS[i + 1] - BOUNDS[i]) * a, BOUNDS[i] + (BOUNDS[i + 1] - BOUNDS[i]) * b);
  t.outline = linear(p, 0.01, BOUNDS[1] * 0.9);
  t.gather = S(1, 0.1, 0.8);
  t.airwires = S(2, 0.1, 0.6);
  t.assemble = S(3, 0.1, 0.9);
  t.traces = S(4, 0.1, 0.9);
  t.check = S(5, 0.1, 0.95);
  t.explode = S(6, 0.15, 0.75);
}

function Driver({ progress, tl, cam, onStage }: { progress: RefObject<number>; tl: RefObject<Timeline>; cam: RefObject<View3 | null>; onStage: (i: number) => void }) {
  const p = useRef(0);
  const last = useRef(-1);
  useFrame((_, dt) => {
    p.current = damp(p.current, progress.current!, 7, Math.min(dt, 1 / 30));
    const P = p.current;
    timelineAt(P, tl.current!);
    // camera: hold each stage's view, travel during the first 35% of the next stage
    const s = stageAt(P);
    const local = (P - BOUNDS[s]) / (BOUNDS[s + 1] - BOUNDS[s]);
    const k = s === 0 ? 1 : easeInOutCubic(linear(local, 0, 0.35));
    const a = VIEWS[Math.max(0, s - 1)], b = VIEWS[s];
    cam.current = {
      az: THREE.MathUtils.lerp(a.az, b.az, k),
      el: THREE.MathUtils.lerp(a.el, b.el, k),
      d: THREE.MathUtils.lerp(a.d, b.d, k),
      t: [THREE.MathUtils.lerp(a.t[0], b.t[0], k), THREE.MathUtils.lerp(a.t[1], b.t[1], k), THREE.MathUtils.lerp(a.t[2], b.t[2], k)],
    };
    if (s !== last.current) {
      last.current = s;
      onStage(s);
    }
  });
  return null;
}

function LayerAnchors({ tl, anchors }: { tl: RefObject<Timeline>; anchors: RefObject<Map<string, THREE.Vector3>> }) {
  useFrame(() => {
    const e = tl.current!.explode;
    for (const l of LAYERS) {
      const a = anchors.current!.get(l.id) ?? new THREE.Vector3();
      a.set(FIELD_NODE.width + 3, l.y(e), FIELD_NODE.height - FIELD_NODE.radius);
      anchors.current!.set(l.id, a);
    }
  });
  return null;
}

export default function ProcessScene({ progress, onStage, layerNames }: { progress: RefObject<number>; onStage: (i: number) => void; layerNames?: Record<string, string> }) {
  const slot = useRef<HTMLDivElement>(null);
  const turn = useRef<Turn>(newTurn());
  const tl = useRef<Timeline>({ ...EMPTY });
  const cam = useRef<View3 | null>(VIEWS[0]);
  const anchors = useRef(new Map<string, THREE.Vector3>());
  const els = useRef(new Map<string, HTMLDivElement>());
  const [lo, setLo] = useState(false);
  useEffect(() => setLo(isCompact()), []);

  const items: LeadItem[] = useMemo(() => LAYERS.map((l) => ({ id: l.id, name: layerNames?.[l.id] ?? l.name, does: l.file })), [layerNames]);
  const visible = useRef((id: string) => (LAYERS.some((l) => l.id === id) ? ramp(tl.current.explode, 0.45, 0.7) : 0));

  return (
    <div ref={slot} className="view-slot absolute inset-0">
      <View className="absolute inset-0">
        <TurnCamera turn={turn} override={cam} fov={28} />
        <Studio rim shadows={!lo} />
        <Board spec={FIELD_NODE} tl={tl} lo={lo} />
        <BoardShadow spec={FIELD_NODE} y={-10} opacity={0.45} blur={8} tl={tl} />
        <Driver progress={progress} tl={tl} cam={cam} onStage={onStage} />
        <LayerAnchors tl={tl} anchors={anchors} />
        <LeadProjector els={els} anchors={anchors} offset={[-FIELD_NODE.width / 2, 0, -FIELD_NODE.height / 2]} slot={slot} visible={visible} />
      </View>
      <Leads items={items} els={els} align="right" lit={null} showDoes />
    </div>
  );
}
