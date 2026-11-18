"use client";

import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { FIELD_NODE } from "@/lib/pcb/boards";
import { damp, easeInOutCubic, linear, ramp } from "@/lib/pcb/materials";
import { Board, type Timeline } from "../three/Board";
import { isCompact } from "../three/Stage";
import { Studio } from "../three/Studio";
import { newTurn, TurnCamera, useTurnInput, type Turn } from "../three/turntable";

/** Line phases, seconds. The loop restarts after LOOP. */
export const LINE = [
  { id: "in", name: "Çıplak kart hatta", from: 0, to: 2.2 },
  { id: "paste", name: "Lehim pastası", from: 2.2, to: 3.6 },
  { id: "place", name: "Dizgi: parçalar yerleşiyor", from: 3.6, to: 13 },
  { id: "reflow", name: "Reflow fırını", from: 13, to: 15.6 },
  { id: "aoi", name: "AOI optik kontrol", from: 15.6, to: 17.6 },
  { id: "out", name: "Teste gidiyor", from: 17.6, to: 19.6 },
];
const LOOP = 20.5;
const SPAN = 0.34;

const W = FIELD_NODE.width, H = FIELD_NODE.height;
const N = FIELD_NODE.parts.length;

const steel = new THREE.MeshStandardMaterial({ color: "#9aa0a6", metalness: 0.8, roughness: 0.35, envMapIntensity: 0.8 });
const dark = new THREE.MeshStandardMaterial({ color: "#16171a", metalness: 0, roughness: 0.85, envMapIntensity: 0.25 });
const belt = new THREE.MeshStandardMaterial({ color: "#121214", roughness: 0.95 });
const accent = new THREE.MeshStandardMaterial({ color: "#5bbfcd", emissive: "#5bbfcd", emissiveIntensity: 0.6, toneMapped: false });

function Line({ tl, clock, onPhase }: { tl: RefObject<Timeline>; clock: RefObject<number>; onPhase: (i: number) => void }) {
  const board = useRef<THREE.Group>(null);
  const gantry = useRef<THREE.Group>(null);
  const carriage = useRef<THREE.Group>(null);
  const nozzle = useRef<THREE.Group>(null);
  const squeegee = useRef<THREE.Mesh>(null);
  const oven = useRef<THREE.MeshStandardMaterial>(null);
  const heat = useRef<THREE.PointLight>(null);
  const head = useRef({ x: -50, z: -46, y: 18 });
  const last = useRef(-1);
  const reels = useMemo(() => Array.from({ length: 9 }, (_, i) => -64 + i * 16), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    clock.current = (clock.current! + dt) % LOOP;
    const t = clock.current!;
    const phase = LINE.findIndex((p) => t >= p.from && t < p.to);
    if (phase !== last.current) {
      last.current = phase;
      onPhase(phase);
    }
    const tlv = tl.current!;
    tlv.outline = 1;
    tlv.traces = 1;
    tlv.airwires = 0;
    tlv.explode = 0;
    tlv.gather = 0;

    // board travel: in from the left, stop under the gantry, leave to the right
    const xin = THREE.MathUtils.lerp(-150, 0, easeInOutCubic(linear(t, 0, 2.2)));
    const xout = THREE.MathUtils.lerp(0, 160, easeInOutCubic(linear(t, 17.6, 19.6)));
    if (board.current) {
      board.current.position.x = t < 17.6 ? xin : xout;
      board.current.visible = t < 19.8;
    }

    // paste: squeegee pass
    if (squeegee.current) {
      const u = linear(t, 2.3, 3.5);
      squeegee.current.position.x = THREE.MathUtils.lerp(-W / 2 - 4, W / 2 + 4, easeInOutCubic(u));
      squeegee.current.visible = u > 0 && u < 1;
    }

    // placement: parts drop in order; the nozzle visits each one
    const pu = linear(t, 3.6, 13);
    tlv.assemble = t < 3.6 ? 0 : pu;
    let target = { x: -50, z: -46, y: 18 };
    if (pu > 0 && pu < 1) {
      let cur = 0;
      for (let i = 0; i < N; i++) if (pu >= (i / (N - 1)) * (1 - SPAN)) cur = i;
      const p = FIELD_NODE.parts[cur];
      const start = (cur / (N - 1)) * (1 - SPAN);
      const local = linear(pu, start, start + SPAN * 0.5);
      // go to the feeder first, then over the part
      const feederX = reels[cur % reels.length];
      const atFeeder = local < 0.25;
      target = atFeeder ? { x: feederX, z: -46, y: 10 } : { x: p.x - W / 2, z: p.y - H / 2, y: 6 + 4 * (1 - ramp(local, 0.4, 0.9)) };
    }
    const h = head.current;
    h.x = damp(h.x, target.x, 9, dt);
    h.z = damp(h.z, target.z, 9, dt);
    h.y = damp(h.y, target.y, 12, dt);
    if (gantry.current) gantry.current.position.x = h.x;
    if (carriage.current) carriage.current.position.z = h.z;
    if (nozzle.current) nozzle.current.position.y = h.y;

    // reflow heat and AOI sweep
    const r = ramp(t, 13, 13.8) * (1 - ramp(t, 15, 15.6));
    if (oven.current) oven.current.emissiveIntensity = 0.2 + 2.2 * r;
    if (heat.current) heat.current.intensity = 9000 * r;
    tlv.check = linear(t, 15.7, 17.5);
  });

  return (
    <>
      {/* conveyor */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, -2.2, s * (H / 2 + 3)]} material={steel} castShadow receiveShadow>
          <boxGeometry args={[320, 3, 2.4]} />
        </mesh>
      ))}
      <mesh position={[0, -4.2, 0]} material={belt} receiveShadow>
        <boxGeometry args={[320, 1, H + 8]} />
      </mesh>
      <mesh position={[0, -14, 0]} material={dark} receiveShadow>
        <boxGeometry args={[340, 18, 150]} />
      </mesh>

      {/* feeder bank with tape reels */}
      {reels.map((x, i) => (
        <group key={x} position={[x, 0, -60]}>
          <mesh position={[0, 4, 0]} material={dark} castShadow>
            <boxGeometry args={[12, 8, 18]} />
          </mesh>
          <mesh position={[0, 20, -6]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[13, 13, 7, 40]} />
            <meshStandardMaterial color={i % 3 === 0 ? "#2c5aa0" : i % 3 === 1 ? "#d9dcde" : "#1d1f22"} roughness={0.4} transparent opacity={0.92} />
          </mesh>
          <mesh position={[0, 20, -6]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[4, 4, 7.4, 24]} />
            <meshStandardMaterial color="#e0dfdb" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* gantry: beam across the line, carriage on the beam, nozzle on the carriage */}
      <group ref={gantry}>
        <mesh position={[0, 34, -8]} material={steel} castShadow>
          <boxGeometry args={[10, 6, 120]} />
        </mesh>
        <group ref={carriage}>
          <mesh position={[0, 28, 0]} material={dark} castShadow>
            <boxGeometry args={[14, 10, 12]} />
          </mesh>
          <mesh position={[7.2, 28, 0]} material={accent}>
            <boxGeometry args={[0.4, 1.2, 8]} />
          </mesh>
          <group ref={nozzle}>
            <mesh position={[0, 10, 0]} material={steel} castShadow>
              <cylinderGeometry args={[1.2, 1.2, 20, 16]} />
            </mesh>
            <mesh position={[0, -0.5, 0]} material={dark}>
              <cylinderGeometry args={[0.5, 0.9, 1.2, 16]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* reflow oven tunnel, downstream */}
      <group position={[112, 0, 0]}>
        <mesh position={[0, 10, 0]} castShadow>
          <boxGeometry args={[70, 26, H + 22]} />
          <meshStandardMaterial color="#202226" metalness={0.5} roughness={0.45} envMapIntensity={0.5} />
        </mesh>
        <mesh position={[-35.2, 4, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[H + 10, 10]} />
          <meshStandardMaterial ref={oven} color="#1a0a04" emissive="#ff6a1a" emissiveIntensity={0.2} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={heat} position={[0, 18, 0]} color="#ff7a2a" intensity={0} distance={140} decay={2} />

      {/* the board */}
      <group ref={board}>
        <Board spec={FIELD_NODE} tl={tl} dropHeight={7} bare />
        <mesh ref={squeegee} position={[0, 3, 0]} visible={false} castShadow>
          <boxGeometry args={[1.2, 6, H + 4]} />
          <meshStandardMaterial color="#c9cdd2" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </>
  );
}

export default function PickPlaceScene({ onPhase }: { onPhase: (i: number) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const turn = useRef<Turn>(newTurn());
  const tl = useRef<Timeline>({ outline: 1, airwires: 0, assemble: 0, traces: 1, check: 0, explode: 0, gather: 0, hop: -1 });
  const clock = useRef(0);
  const [lo, setLo] = useState(false);
  useEffect(() => setLo(isCompact()), []);
  useTurnInput(slot, turn);
  return (
    <div ref={slot} className="view-slot grab absolute inset-0">
      <View className="absolute inset-0">
        <TurnCamera turn={turn} target={[0, 4, -8]} azimuth={-30} elevation={38} distance={330} fov={30} idleReturn={6} />
        <Studio rim shadows={!lo} extent={140} />
        <Line tl={tl} clock={clock} onPhase={onPhase} />
      </View>
    </div>
  );
}
