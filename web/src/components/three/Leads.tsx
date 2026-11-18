"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";

export interface LeadItem {
  id: string;
  ref?: string;
  name: string;
  does?: string;
  always?: boolean; // visible without hover
}

/** DOM labels laid over a 3D view; positions are written by <LeadProjector> every frame. */
export function Leads({ items, els, lit, align = "above", showDoes = false }: { items: LeadItem[]; els: RefObject<Map<string, HTMLDivElement>>; lit?: string | null; align?: "above" | "right"; showDoes?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden>
      {items.map((it) => (
        <div
          key={it.id}
          ref={(el) => {
            if (el) els.current!.set(it.id, el);
            else els.current!.delete(it.id);
          }}
          className={`lead ${lit === it.id ? "lit" : ""}`}
          style={{ opacity: 0 }}
        >
          <div className={`lead-card flex-col !items-start !gap-0.5 ${align === "above" ? "-translate-x-1/2 -translate-y-[calc(100%+10px)]" : "translate-x-[34px] -translate-y-1/2"}`}>
            <span className="flex gap-1.5">
              {it.ref && <span className="ref">{it.ref}</span>}
              <span>{it.name}</span>
            </span>
            {(showDoes || lit === it.id) && it.does && <span className={showDoes ? "text-[10.5px] text-t-3" : "font-sans text-[11.5px] text-t-2"}>{it.does}</span>}
          </div>
          {align === "above" ? <div className="absolute left-0 top-0 h-[10px] w-px -translate-y-[10px] bg-[var(--line-3)]" /> : <div className="absolute left-0 top-0 h-px w-[30px] bg-[var(--line-3)]" />}
        </div>
      ))}
    </div>
  );
}

const v = new THREE.Vector3();

export function LeadProjector({
  els,
  anchors,
  offset = [0, 0, 0],
  slot,
  visible,
}: {
  els: RefObject<Map<string, HTMLDivElement>>;
  anchors: RefObject<Map<string, THREE.Vector3>>;
  offset?: [number, number, number];
  slot: RefObject<HTMLElement | null>;
  visible: RefObject<(id: string) => number>;
}) {
  const ops = useRef(new Map<string, number>());
  useFrame(({ camera }, dt) => {
    const box = slot.current;
    if (!box) return;
    const W = box.clientWidth, H = box.clientHeight;
    for (const [id, el] of els.current!) {
      const a = anchors.current!.get(id);
      const target = a ? visible.current!(id) : 0;
      const o = THREE.MathUtils.lerp(ops.current.get(id) ?? 0, target, 1 - Math.exp(-12 * Math.min(dt, 1 / 30)));
      ops.current.set(id, o);
      if (!a) {
        el.style.opacity = "0";
        continue;
      }
      v.set(a.x + offset[0], a.y + offset[1], a.z + offset[2]).project(camera);
      const x = THREE.MathUtils.clamp(((v.x + 1) / 2) * W, 4, W - 4);
      const y = THREE.MathUtils.clamp(((1 - v.y) / 2) * H, 4, H - 4);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = o.toFixed(3);
    }
  });
  return null;
}
