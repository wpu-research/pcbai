"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { modelUrl } from "@/lib/pcb/geometry";
import { tunePartMaterial } from "@/lib/pcb/materials";
import type { Footprint } from "@/lib/pcb/types";

export interface PartMats {
  mats: THREE.MeshStandardMaterial[];
  base: THREE.Color[];
}

/** A KiCad library model (metres) placed on its footprint; materials cloned per instance. */
export function usePartObject(key: string, fp: Footprint | undefined, lo = false) {
  const gltf = useGLTF(modelUrl(key, lo), false, true);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      const src = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = src.map((x) => {
        const c = (x as THREE.MeshStandardMaterial).clone();
        tunePartMaterial(c);
        c.transparent = true;
        c.forceSinglePass = true;
        mats.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? cloned : cloned[0];
    });
    const fit = fp?.model;
    const holder = new THREE.Group();
    if (fit) {
      const [ox = 0, oy = 0, oz = 0] = fit.offset ?? [];
      const [rx = 0, ry = 0, rz = 0] = fit.rotate ?? [];
      const [sx = 1, sy = 1, sz = 1] = fit.scale ?? [];
      root.position.set(ox / 1000, oz / 1000, -oy / 1000);
      root.rotation.set(THREE.MathUtils.degToRad(-rx), THREE.MathUtils.degToRad(-rz), THREE.MathUtils.degToRad(ry), "YZX");
      root.scale.set(sx, sz, sy);
    }
    holder.add(root);
    holder.scale.setScalar(1000);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    return { object: holder, mats, base: mats.map((m) => m.color.clone()), top: box.max.y };
  }, [gltf, fp]);
}

export function preloadParts(keys: string[], lo = false) {
  for (const k of new Set(keys)) useGLTF.preload(modelUrl(k, lo), false, true);
}

/** A 2.54 mm female header socket, built in code (no GLB): black body, gold contacts on top. */
export function useHeaderObject(fp: Footprint) {
  return useMemo(() => {
    const n = fp.pads.length, pitch = 2.54, h = 8.5;
    const body = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.55, metalness: 0, envMapIntensity: 0.6 });
    const pin = new THREE.MeshStandardMaterial({ color: "#d4ab55", roughness: 0.25, metalness: 1, envMapIntensity: 1.1 });
    const hole = new THREE.MeshStandardMaterial({ color: "#050506", roughness: 1 });
    for (const m of [body, pin, hole]) {
      m.transparent = true;
      m.forceSinglePass = true;
    }
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(n * pitch - 0.1, h, pitch - 0.1), body);
    box.position.y = h / 2;
    box.castShadow = box.receiveShadow = true;
    g.add(box);
    for (const p of fp.pads) {
      const sq = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), hole);
      sq.position.set(p.x, h + 0.01, p.y);
      g.add(sq);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.64, 3, 0.64), pin);
      leg.position.set(p.x, -1.5, p.y);
      g.add(leg);
    }
    const mats = [body, pin, hole];
    return { object: g, mats, base: mats.map((m) => m.color.clone()), top: h };
  }, [fp]);
}
