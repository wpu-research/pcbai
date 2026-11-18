"use client";

import { View } from "@react-three/drei";
import { useRef } from "react";
import type { BoardSpec } from "@/lib/pcb/types";
import { Board, BoardShadow, DONE, type Timeline } from "../three/Board";
import { Studio } from "../three/Studio";
import { newTurn, TurnCamera, useTurnInput, type Turn } from "../three/turntable";

/** Live 3D of the board being edited; the spec id changes on every edit so the board rebuilds. */
export default function EditorScene({ spec }: { spec: BoardSpec }) {
  const slot = useRef<HTMLDivElement>(null);
  const turn = useRef<Turn>(newTurn());
  const tl = useRef<Timeline>({ ...DONE });
  useTurnInput(slot, turn);
  const size = Math.max(spec.width, spec.height);
  return (
    <div ref={slot} className="view-slot grab absolute inset-0">
      <View className="absolute inset-0">
        <TurnCamera turn={turn} target={[0, -2, 0]} azimuth={-24} elevation={42} distance={size * 1.9 + 20} fov={30} idleReturn={0} />
        <Studio rim extent={Math.max(70, size)} />
        <Board key={spec.id} spec={spec} tl={tl} />
        <BoardShadow spec={spec} y={-8} opacity={0.5} blur={7} />
      </View>
    </div>
  );
}
