"use client";

import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useState } from "react";

export const isCompact = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(max-width: 639px)").matches ||
    (window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820));

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** One fixed, full-screen WebGL canvas; every section draws into it through a drei <View>. */
export default function Stage() {
  const [ok, setOk] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    setOk(webglAvailable());
    setCompact(isCompact());
  }, []);
  if (!ok) return null;
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, compact ? 1.25 : 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
      eventSource={document.body}
      eventPrefix="client"
      aria-hidden
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }}
    >
      <View.Port />
    </Canvas>
  );
}
