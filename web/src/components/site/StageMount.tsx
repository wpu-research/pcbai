"use client";

import dynamic from "next/dynamic";

const Stage = dynamic(() => import("../three/Stage"), { ssr: false });

export default function StageMount() {
  return <Stage />;
}
