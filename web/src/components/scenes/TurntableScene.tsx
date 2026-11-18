"use client";

import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { FIELD_NODE } from "@/lib/pcb/boards";
import { damp } from "@/lib/pcb/materials";
import { Board, BoardShadow, DONE, type Timeline } from "../three/Board";
import { isCompact } from "../three/Stage";
import { Studio } from "../three/Studio";
import { newTurn, TurnCamera, useTurnInput, type Turn } from "../three/turntable";

function Explode({ tl, explode }: { tl: React.RefObject<Timeline>; explode: React.RefObject<number> }) {
  useFrame((_, dt) => {
    tl.current!.explode = damp(tl.current!.explode, explode.current!, 6, Math.min(dt, 1 / 30));
  });
  return null;
}

/** The finished board on a slow turntable; optionally pulled apart into layers. */
export default function TurntableScene({ explode = 0, distance = 96, elevation = 34 }: { explode?: number; distance?: number; elevation?: number }) {
  const slot = useRef<HTMLDivElement>(null);
  const turn = useRef<Turn>(newTurn());
  const tl = useRef<Timeline>({ ...DONE });
  const ex = useRef(explode);
  const [lo, setLo] = useState(false);
  useEffect(() => setLo(isCompact()), []);
  useEffect(() => {
    ex.current = explode;
  }, [explode]);
  useTurnInput(slot, turn);
  return (
    <div ref={slot} className="view-slot grab absolute inset-0">
      <View className="absolute inset-0">
        <TurnCamera turn={turn} target={[0, explode ? 12 : -3, 0]} azimuth={-28} elevation={elevation} distance={distance} fov={30} drift={3} idleReturn={0} />
        <Studio rim shadows={!lo} />
        <Board spec={FIELD_NODE} tl={tl} lo={lo} />
        <BoardShadow spec={FIELD_NODE} y={-8} opacity={0.5} blur={7} tl={tl} />
        <Explode tl={tl} explode={ex} />
      </View>
    </div>
  );
}
