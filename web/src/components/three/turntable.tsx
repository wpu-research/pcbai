"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { damp, easeInOutCubic } from "@/lib/pcb/materials";

export interface Turn {
  yaw: number; // drag offset, radians
  pitch: number;
  yawTarget: number;
  pitchTarget: number;
  px: number; // pointer parallax -1..1
  py: number;
  dragging: boolean;
  lastInput: number; // ms
  drift: number; // accumulated auto-rotate
  returning: null | { t0: number; from: [number, number]; dur: number };
  hover: boolean;
}

const RATE = 0.0055;

export function newTurn(): Turn {
  return { yaw: 0, pitch: 0, yawTarget: 0, pitchTarget: 0, px: 0, py: 0, dragging: false, lastInput: 0, drift: 0, returning: null, hover: false };
}

/** Pointer handling on the DOM slot (the canvas itself ignores pointer events). */
export function useTurnInput(el: RefObject<HTMLElement | null>, turn: RefObject<Turn>, opts: { pitchMin?: number; pitchMax?: number } = {}) {
  const { pitchMin = -0.5, pitchMax = 0.6 } = opts;
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let x0 = 0, y0 = 0, yaw0 = 0, pitch0 = 0, id = -1, touch = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = turn.current!;
      id = e.pointerId;
      touch = e.pointerType === "touch";
      x0 = e.clientX;
      y0 = e.clientY;
      yaw0 = t.yawTarget;
      pitch0 = t.pitchTarget;
      t.dragging = true;
      t.returning = null;
      t.lastInput = performance.now();
      node.setPointerCapture(id);
    };
    const move = (e: PointerEvent) => {
      const t = turn.current!;
      const r = node.getBoundingClientRect();
      t.px = ((e.clientX - r.left) / r.width) * 2 - 1;
      t.py = ((e.clientY - r.top) / r.height) * 2 - 1;
      t.lastInput = performance.now();
      if (!t.dragging || e.pointerId !== id) return;
      t.yawTarget = yaw0 - (e.clientX - x0) * RATE;
      if (!touch) t.pitchTarget = THREE.MathUtils.clamp(pitch0 + (e.clientY - y0) * RATE * 0.7, pitchMin, pitchMax);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      turn.current!.dragging = false;
      try {
        node.releasePointerCapture(id);
      } catch {}
    };
    const enter = () => (turn.current!.hover = true);
    const leave = () => {
      turn.current!.hover = false;
      turn.current!.px = turn.current!.py = 0;
    };
    const dbl = () => {
      const t = turn.current!;
      t.returning = { t0: performance.now(), from: [t.yawTarget, t.pitchTarget], dur: 900 };
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("pointerenter", enter);
    node.addEventListener("pointerleave", leave);
    node.addEventListener("dblclick", dbl);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("pointerenter", enter);
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("dblclick", dbl);
    };
  }, [el, turn, pitchMin, pitchMax]);
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Spherical camera around `target`: rest direction (azimuth/elevation in degrees),
 * plus drag offsets, pointer parallax, slow drift, and an eased return after idling.
 */
export function TurnCamera({
  turn,
  target = [0, 0, 0],
  azimuth = -22,
  elevation = 48,
  distance = 120,
  fov = 30,
  drift = 0,
  idleReturn = 4,
  override,
}: {
  turn: RefObject<Turn>;
  target?: [number, number, number];
  azimuth?: number;
  elevation?: number;
  distance?: number;
  fov?: number;
  drift?: number; // deg/s
  idleReturn?: number; // seconds, 0 = never
  override?: RefObject<{ az: number; el: number; d: number; t: [number, number, number] } | null>;
}) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const size = useThree((s) => s.size);
  const look = useRef(new THREE.Vector3(...target));
  const still = useRef(reduced());

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const t = turn.current!;
    const c = cam.current;
    if (!c) return;
    const now = performance.now();
    if (t.returning) {
      const u = Math.min(1, (now - t.returning.t0) / t.returning.dur);
      const k = 1 - easeInOutCubic(u);
      t.yawTarget = t.returning.from[0] * k;
      t.pitchTarget = t.returning.from[1] * k;
      if (u >= 1) t.returning = null;
    } else if (idleReturn && !t.dragging && !t.hover && now - t.lastInput > idleReturn * 1000 && (Math.abs(t.yawTarget) > 0.01 || Math.abs(t.pitchTarget) > 0.01)) {
      const dur = Math.min(2.4, 0.9 + 0.5 * Math.hypot(t.yawTarget, t.pitchTarget)) * 1000;
      t.returning = { t0: now, from: [t.yawTarget, t.pitchTarget], dur };
    }
    if (drift && !still.current && !t.dragging && !t.hover) t.drift += THREE.MathUtils.degToRad(drift) * dt;
    t.yaw = damp(t.yaw, t.yawTarget, 14, dt);
    t.pitch = damp(t.pitch, t.pitchTarget, 14, dt);
    const ppx = still.current ? 0 : t.px, ppy = still.current ? 0 : t.py;

    const o = override?.current;
    const az = THREE.MathUtils.degToRad(o ? o.az : azimuth) + t.yaw + t.drift + THREE.MathUtils.degToRad(3) * ppx;
    const el = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(o ? o.el : elevation) + t.pitch + THREE.MathUtils.degToRad(1.5) * ppy, 0.05, 1.5);
    const aspect = size.width / Math.max(1, size.height);
    const d = (o ? o.d : distance) * Math.max(1, 1.6 / aspect);
    const tg = o ? o.t : target;
    look.current.set(tg[0], tg[1], tg[2]);
    c.position.set(tg[0] + d * Math.cos(el) * Math.sin(az), tg[1] + d * Math.sin(el), tg[2] + d * Math.cos(el) * Math.cos(az));
    c.lookAt(look.current);
  });

  return <PerspectiveCamera ref={cam} makeDefault fov={fov} near={2} far={2000} />;
}
