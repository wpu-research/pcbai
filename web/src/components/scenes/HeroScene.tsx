"use client";

import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PART_TR } from "@/lib/dict";
import { useI18n } from "@/lib/i18n";
import { FIELD_NODE } from "@/lib/pcb/boards";
import { Board, BoardShadow, DONE, type Timeline } from "../three/Board";
import { LeadProjector, Leads, type LeadItem } from "../three/Leads";
import { isCompact } from "../three/Stage";
import { Studio } from "../three/Studio";
import { newTurn, TurnCamera, useTurnInput, type Turn } from "../three/turntable";

export const STAGES = ["Brief", "Parts", "Schematic", "Placement", "Routing", "DRC", "Order"];

function Clock({ tl, running, onStage }: { tl: React.RefObject<Timeline>; running: React.RefObject<boolean>; onStage: (i: number) => void }) {
  const last = useRef(-1);
  useFrame((_, dt) => {
    if (!running.current) return;
    const t = tl.current!;
    t.hop = t.hop < 0 ? 0 : t.hop + Math.min(dt, 1 / 30);
    const stage = Math.min(STAGES.length, Math.floor(t.hop / 0.34));
    if (stage !== last.current) {
      last.current = stage;
      onStage(stage);
    }
    if (t.hop > 3) {
      t.hop = -1;
      running.current = false;
    }
  });
  return null;
}

export default function HeroScene({ onStage }: { onStage: (i: number) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const turn = useRef<Turn>(newTurn());
  const tl = useRef<Timeline>({ ...DONE });
  const running = useRef(false);
  const hovered = useRef<string | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const anchors = useRef(new Map<string, THREE.Vector3>());
  const els = useRef(new Map<string, HTMLDivElement>());
  const [lo, setLo] = useState(false);
  useEffect(() => setLo(isCompact()), []);
  useTurnInput(slot, turn);

  const { lang } = useI18n();
  const items: LeadItem[] = useMemo(
    () =>
      FIELD_NODE.parts.map((p) => {
        const tr = lang === "tr" ? PART_TR[p.ref] : undefined;
        return { id: p.ref, ref: p.ref, name: tr?.name ?? p.name, does: tr ? tr.does : p.does, always: p.label };
      }),
    [lang],
  );
  const always = useMemo(() => new Set(items.filter((i) => i.always).map((i) => i.id)), [items]);
  const visible = useRef((id: string) => {
    const h = hovered.current;
    if (h) return id === h ? 1 : always.has(id) ? 0.35 : 0;
    return 0;
  });

  const onHover = useCallback((ref: string | null) => {
    hovered.current = ref;
    setLit(ref);
  }, []);
  const onReady = useCallback(() => {
    running.current = true;
  }, []);

  return (
    <div ref={slot} className="view-slot grab absolute inset-0">
      <View className="absolute inset-0">
        <TurnCamera turn={turn} target={[0, -4, 2]} azimuth={-20} elevation={36} distance={84} fov={30} />
        <Studio rim shadowSize={2048} shadows={!lo} />
        <Board spec={FIELD_NODE} tl={tl} lo={lo} hovered={hovered} onHover={onHover} anchors={anchors} onReady={onReady} />
        <BoardShadow spec={FIELD_NODE} y={-8} opacity={0.5} blur={7} />
        <Clock tl={tl} running={running} onStage={onStage} />
        <LeadProjector els={els} anchors={anchors} offset={[-FIELD_NODE.width / 2, 0, -FIELD_NODE.height / 2]} slot={slot} visible={visible} />
      </View>
      <Leads items={items} els={els} lit={lit} />
    </div>
  );
}
