"use client";

import { Environment, Lightformer } from "@react-three/drei";

type Panel = [k: number, color: string, pos: [number, number, number], size: [number, number]];

function panels(rim: boolean): Panel[] {
  return [
    [1.6, "white", [0, 100, -110], [120, 26]], // big top-back softbox
    [0.25, "white", [0, 100, 0], [140, 140]], // ceiling
    [rim ? 1 : 0.8, rim ? "#edf8fa" : "white", [-110, 75, -95], [90, 40]], // teal-tinted left-back
    [0.7, rim ? "#fdf5f7" : "white", [110, 72, -90], [90, 40]], // pink-tinted right-back
    [0.9, "white", [-120, 20, 40], [120, 18]], // left strip
    [0.7, "white", [120, 15, 30], [120, 18]], // right strip
    [0.5, "white", [0, 25, 130], [90, 30]], // front strip
  ];
}

/** Procedural studio reflections: seven bright panels baked into a 256px cube, no HDR file. */
export function StudioEnvironment({ rim = true }: { rim?: boolean }) {
  return (
    <Environment resolution={256} frames={1} background={false}>
      <color attach="background" args={["#000000"]} />
      {panels(rim).map(([k, color, pos, [w, h]], i) => (
        <Lightformer key={i} form="rect" intensity={k} color={color} position={pos} scale={[w, h, 1]} target={[0, 0, 0]} />
      ))}
    </Environment>
  );
}

/** Key/fill/rim rig shared by the board scenes. */
export function Studio({ rim = true, shadowSize = 1024, shadows = true, extent = 70 }: { rim?: boolean; shadowSize?: number; shadows?: boolean; extent?: number }) {
  return (
    <>
      <StudioEnvironment rim={rim} />
      <ambientLight intensity={0.08} />
      <hemisphereLight args={["#d8e1e9", "#2b2622", 0.25]} />
      <directionalLight
        position={[-70, 120, 55]}
        intensity={2.8}
        color="#fff5ea"
        castShadow={shadows}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.00035}
        shadow-normalBias={0.02}
        shadow-radius={(4 * shadowSize) / 2048}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={400}
      />
      <directionalLight position={[90, 35, 95]} intensity={0.6} color="#dde7ee" />
      {rim && (
        <>
          <directionalLight position={[-95, 48, -75]} intensity={1.7} color="#a3dce4" />
          <directionalLight position={[100, 42, -65]} intensity={1.3} color="#f4cbd6" />
        </>
      )}
    </>
  );
}
