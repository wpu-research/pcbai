import { partBox } from "@/lib/pcb/drc";
import { MASKS } from "@/lib/pcb/materials";
import type { BoardSpec, Footprint } from "@/lib/pcb/types";

/** Small top-view drawing of a board for lists. */
export function BoardThumb({ spec, fps }: { spec: BoardSpec; fps: Map<string, Footprint> }) {
  const pad = 4;
  return (
    <svg viewBox={`${-pad} ${-pad} ${spec.width + pad * 2} ${spec.height + pad * 2}`} className="h-full w-full" aria-hidden>
      <rect width={spec.width} height={spec.height} rx={spec.radius} fill={MASKS[spec.finish.mask].three} stroke="#d3c39c" strokeWidth={0.35} />
      {spec.holes.map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r={h.d / 2 + 1} fill="#d6b46c" stroke="#070708" strokeWidth={h.d * 0.6} />
      ))}
      {spec.parts.map((p) => {
        const fp = fps.get(p.footprint);
        if (!fp) return null;
        const b = partBox(fp, p);
        const big = (b.x1 - b.x0) * (b.y1 - b.y0) > 40;
        return <rect key={p.ref} x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.4} fill={big ? "#2a2c30" : "#3a3c40"} stroke="#ffffff22" strokeWidth={0.2} />;
      })}
    </svg>
  );
}
