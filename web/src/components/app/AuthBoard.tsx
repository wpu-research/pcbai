"use client";

import dynamic from "next/dynamic";

const TurntableScene = dynamic(() => import("../scenes/TurntableScene"), { ssr: false });
const Stage = dynamic(() => import("../three/Stage"), { ssr: false });

export default function AuthBoard() {
  return (
    <>
      <div className="pool absolute inset-0">
        <TurntableScene distance={110} />
      </div>
      <div className="fig absolute bottom-6 left-8 z-[2]">
        <b>Fig.</b> · Wi-Fi environment node · 70 × 40 mm · ENIG
      </div>
      <Stage />
    </>
  );
}
