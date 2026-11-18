"use client";

import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { FIELD_NODE } from "@/lib/pcb/boards";
import { easeInOutCubic, easeOutCubic, linear } from "@/lib/pcb/materials";
import { Board, DONE, type Timeline } from "../three/Board";
import { isCompact } from "../three/Stage";
import { Studio } from "../three/Studio";
import { newTurn, TurnCamera, useTurnInput, type Turn } from "../three/turntable";

export const SHIP = [
  { name: "Test geçti", from: 0, to: 1.6 },
  { name: "Antistatik poşet", from: 1.6, to: 3.4 },
  { name: "Kutuya", from: 3.4, to: 5.2 },
  { name: "Kapak kapanıyor", from: 5.2, to: 7.2 },
  { name: "Etiket ve kargo", from: 7.2, to: 10 },
];
const LOOP = 11;

const BW = 110, BD = 74, BH = 34, T = 1.4; // box outer size, wall

function labelTexture() {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 400;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f4f2ec";
  x.fillRect(0, 0, 640, 400);
  x.fillStyle = "#1b1d1f";
  x.font = "600 44px Helvetica, Arial, sans-serif";
  x.fillText("pcb·ai", 32, 66);
  x.font = "400 22px Helvetica, Arial, sans-serif";
  x.fillText("GÖNDERİ · 1 / 1", 400, 60);
  x.fillRect(32, 92, 576, 3);
  x.font = "500 30px Helvetica, Arial, sans-serif";
  x.fillText("Alıcı: Atölye 3B", 32, 146);
  x.font = "400 24px Helvetica, Arial, sans-serif";
  x.fillText("İçerik: 5 × dizili PCB (PCBA)", 32, 186);
  x.fillText("Ağırlık: 0,4 kg · ESD hassas", 32, 222);
  for (let i = 0; i < 64; i++) {
    const w = [2, 3, 5][(i * 7) % 3];
    x.fillRect(32 + i * 9, 262, w, 90);
  }
  x.font = "400 20px Helvetica, Arial, sans-serif";
  x.fillText("TR 4821 7730 19", 32, 380);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Packing({ tl, clock, onPhase }: { tl: RefObject<Timeline>; clock: RefObject<number>; onPhase: (i: number) => void }) {
  const board = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Mesh>(null);
  const flaps = useRef<(THREE.Group | null)[]>([]);
  const label = useRef<THREE.Mesh>(null);
  const box = useRef<THREE.Group>(null);
  const last = useRef(-1);
  const card = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a98157", roughness: 0.92, envMapIntensity: 0.4 }), []);
  const cardIn = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8f6a45", roughness: 0.95, envMapIntensity: 0.3, side: THREE.DoubleSide }), []);
  const foam = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2c31", roughness: 0.95 }), []);
  const tex = useMemo(labelTexture, []);

  useFrame((_, dt) => {
    clock.current = (clock.current! + Math.min(dt, 1 / 30)) % LOOP;
    const t = clock.current!;
    const ph = SHIP.findIndex((p) => t >= p.from && t < p.to);
    if (ph !== last.current) {
      last.current = ph;
      onPhase(Math.max(0, ph));
    }
    tl.current!.check = linear(t, 0.1, 1.4);

    // board: hover above, get bagged, drop into the box
    const drop = easeInOutCubic(linear(t, 3.4, 5.0));
    if (board.current) {
      board.current.position.y = THREE.MathUtils.lerp(48, 9, drop);
      board.current.rotation.y = THREE.MathUtils.lerp(-0.5, 0, easeOutCubic(linear(t, 0, 3.4)));
    }
    if (bag.current) {
      const b = easeOutCubic(linear(t, 1.6, 3.0));
      bag.current.scale.set(1, Math.max(0.001, b), 1);
      (bag.current.material as THREE.MeshPhysicalMaterial).opacity = 0.55 * b;
      bag.current.visible = b > 0.01;
    }
    // four flaps fold shut, the long ones last
    const order = [0, 1, 2, 3];
    order.forEach((i) => {
      const f = flaps.current[i];
      if (!f) return;
      const s = 5.2 + (i < 2 ? 0 : 0.7);
      const u = easeInOutCubic(linear(t, s, s + 1.1));
      const open = i === 0 ? 2.2 : i === 1 ? -2.2 : i === 2 ? -2.0 : 2.0;
      if (i < 2) f.rotation.z = THREE.MathUtils.lerp(open, 0, u);
      else f.rotation.x = THREE.MathUtils.lerp(open, 0, u);
    });
    if (label.current) {
      const u = easeOutCubic(linear(t, 7.3, 8.0));
      label.current.position.y = BH + 0.25 + (1 - u) * 14;
      (label.current.material as THREE.MeshStandardMaterial).opacity = u;
      label.current.visible = u > 0.01;
    }
    if (box.current) box.current.position.x = THREE.MathUtils.lerp(0, 220, easeInOutCubic(linear(t, 9.0, 10.6)));
  });

  const wall = (w: number, h: number, d: number, p: [number, number, number]) => (
    <mesh position={p} material={card} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );

  return (
    <group ref={box}>
      {/* box body */}
      {wall(BW, T, BD, [0, T / 2, 0])}
      {wall(BW, BH, T, [0, BH / 2, BD / 2 - T / 2])}
      {wall(BW, BH, T, [0, BH / 2, -BD / 2 + T / 2])}
      {wall(T, BH, BD, [BW / 2 - T / 2, BH / 2, 0])}
      {wall(T, BH, BD, [-BW / 2 + T / 2, BH / 2, 0])}
      <mesh position={[0, 4, 0]} material={foam} receiveShadow>
        <boxGeometry args={[BW - 2 * T - 0.2, 6, BD - 2 * T - 0.2]} />
      </mesh>
      {/* flaps: hinge at the top edges */}
      <group ref={(o) => void (flaps.current[0] = o)} position={[-BW / 2, BH, 0]}>
        <mesh position={[BW / 4, 0, 0]} material={cardIn} castShadow>
          <boxGeometry args={[BW / 2, T, BD]} />
        </mesh>
      </group>
      <group ref={(o) => void (flaps.current[1] = o)} position={[BW / 2, BH, 0]}>
        <mesh position={[-BW / 4, 0, 0]} material={cardIn} castShadow>
          <boxGeometry args={[BW / 2, T, BD]} />
        </mesh>
      </group>
      <group ref={(o) => void (flaps.current[2] = o)} position={[0, BH + T, BD / 2]}>
        <mesh position={[0, 0, -BD / 4]} material={card} castShadow>
          <boxGeometry args={[BW, T, BD / 2]} />
        </mesh>
      </group>
      <group ref={(o) => void (flaps.current[3] = o)} position={[0, BH + T, -BD / 2]}>
        <mesh position={[0, 0, BD / 4]} material={card} castShadow>
          <boxGeometry args={[BW, T, BD / 2]} />
        </mesh>
      </group>
      <mesh ref={label} rotation-x={-Math.PI / 2} position={[10, BH + 2.2, 4]} visible={false}>
        <planeGeometry args={[64, 40]} />
        <meshStandardMaterial map={tex} roughness={0.7} transparent />
      </mesh>

      {/* the finished board, then its ESD bag */}
      <group ref={board} position={[0, 48, 0]}>
        <Board spec={FIELD_NODE} tl={tl} />
        <mesh ref={bag} position={[0, 4, 0]} visible={false}>
          <boxGeometry args={[FIELD_NODE.width + 10, 9, FIELD_NODE.height + 10]} />
          <meshPhysicalMaterial color="#9aa3ad" metalness={0.6} roughness={0.25} transparent opacity={0} clearcoat={1} depthWrite={false} />
        </mesh>
      </group>
      {/* floor catcher */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[600, 400]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
    </group>
  );
}

export default function ShipScene({ onPhase }: { onPhase: (i: number) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const turn = useRef<Turn>(newTurn());
  const tl = useRef<Timeline>({ ...DONE });
  const clock = useRef(0);
  const [lo, setLo] = useState(false);
  useEffect(() => setLo(isCompact()), []);
  useTurnInput(slot, turn);
  return (
    <div ref={slot} className="view-slot grab absolute inset-0">
      <View className="absolute inset-0">
        <TurnCamera turn={turn} target={[0, 18, 0]} azimuth={-28} elevation={30} distance={330} fov={30} idleReturn={6} />
        <Studio rim shadows={!lo} extent={140} />
        <Packing tl={tl} clock={clock} onPhase={onPhase} />
      </View>
    </div>
  );
}
