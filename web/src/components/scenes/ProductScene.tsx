"use client";

import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { easeInOutCubic, linear } from "@/lib/pcb/materials";
import { productMaterial, screenTexture, shapeGeometry, type Product } from "@/lib/products";
import { Board, DONE, type Timeline } from "../three/Board";
import { isCompact } from "../three/Stage";
import { Studio } from "../three/Studio";
import { newTurn, TurnCamera, useTurnInput, type Turn } from "../three/turntable";

/** Farther-moving parts start first; the board leaves last. */
function plan(p: Product) {
  const ds = p.parts.map((x) => x.distance);
  const maxD = Math.max(...ds, 1);
  const start = ds.map((d) => (Math.round((1 - d / maxD) * 4) / 4) * 0.4);
  const boardStart = Math.max(...start) + 0.06;
  const span = Math.max(0.2, 1 - boardStart);
  return { start, boardStart, span };
}

function Assembly({ product, open, view }: { product: Product; open: RefObject<boolean>; view: RefObject<{ az: number; el: number; d: number; t: [number, number, number] } | null> }) {
  const groups = useRef<(THREE.Object3D | null)[]>([]);
  const board = useRef<THREE.Group>(null);
  const t = useRef(0);
  const root = useRef<THREE.Group>(null);
  const tl = useRef<Timeline>({ ...DONE });
  const { start, boardStart, span } = useMemo(() => plan(product), [product]);
  const mats = useMemo(
    () =>
      product.parts.map((p) => {
        if (p.mat !== "screen") return productMaterial(p.mat);
        const tex = screenTexture(p.shape.kind === "screen" ? p.shape.screen : "off");
        return new THREE.MeshStandardMaterial({ color: "#000", emissive: "#fff", emissiveMap: tex, emissiveIntensity: 0.85, roughness: 0.6, envMapIntensity: 0.2 });
      }),
    [product],
  );

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const target = open.current ? 1 : 0;
    t.current += Math.sign(target - t.current) * Math.min(Math.abs(target - t.current), dt / 1.8);
    let sum = 0, sumD = 0, minY = 0;
    product.parts.forEach((p, i) => {
      const o = groups.current[i];
      const k = easeInOutCubic(linear(t.current, start[i], start[i] + span));
      sum += k * p.distance;
      sumD += p.distance;
      const low = p.shape.kind === "screw" ? p.shape.h + 1 : 0;
      minY = Math.min(minY, p.pos[1] + p.dir[1] * p.distance * k - low + (p.id === "feet" ? 0 : 0));
      if (!o) return;
      const d = new THREE.Vector3(...p.dir).normalize().multiplyScalar(p.distance * k);
      o.position.set(p.pos[0] + d.x, p.pos[1] + d.y, p.pos[2] + d.z);
    });
    const kb = easeInOutCubic(linear(t.current, boardStart - 0.2, boardStart - 0.2 + span));
    if (board.current) {
      const b = product.board;
      const d = new THREE.Vector3(...b.dir).normalize().multiplyScalar(b.distance * kb);
      board.current.position.set(b.pos[0] + d.x, b.pos[1] + d.y, b.pos[2] + d.z);
    }
    if (root.current) root.current.position.y = -minY;
    const o = sumD ? sum / sumD : 0;
    const v = product.view;
    view.current = { az: v.az, el: THREE.MathUtils.lerp(v.el, v.openEl, o), d: THREE.MathUtils.lerp(v.d, v.openD, o), t: v.target };
  });

  return (
    <>
    <group ref={root}>
      {product.parts.map((p, i) => (
        <mesh
          key={p.id}
          ref={(o) => void (groups.current[i] = o)}
          geometry={shapeGeometry(p.shape)}
          material={mats[i]}
          position={p.pos}
          rotation={p.rot ?? [0, 0, 0]}
          castShadow={p.mat !== "light-pipe"}
          receiveShadow
        />
      ))}
      <group ref={board} position={product.board.pos}>
        <Board spec={product.board.spec} tl={tl} />
      </group>
    </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <shadowMaterial opacity={0.4} />
      </mesh>
    </>
  );
}

export default function ProductScene({ product, open }: { product: Product; open: boolean }) {
  const slot = useRef<HTMLDivElement>(null);
  const turn = useRef<Turn>(newTurn());
  const openRef = useRef(open);
  const view = useRef<{ az: number; el: number; d: number; t: [number, number, number] } | null>(null);
  const [lo, setLo] = useState(false);
  useEffect(() => setLo(isCompact()), []);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useTurnInput(slot, turn);
  return (
    <div ref={slot} className="view-slot grab absolute inset-0">
      <View className="absolute inset-0">
        <TurnCamera turn={turn} override={view} fov={28} drift={0.5} idleReturn={0} />
        <Studio rim shadows={!lo} extent={120} />
        <Assembly key={product.id} product={product} open={openRef} view={view} />
      </View>
    </div>
  );
}
