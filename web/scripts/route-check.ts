import { readFileSync } from "node:fs";
import { routingCrossings } from "../src/lib/pcb/drc";
import { routeBoard } from "../src/lib/pcb/geometry";
import { TEMPLATES } from "../src/lib/pcb/templates";
import type { Footprint } from "../src/lib/pcb/types";
for (const [k, spec] of Object.entries(TEMPLATES)) {
  const fps = new Map<string, Footprint>();
  for (const p of spec.parts) fps.set(p.footprint, JSON.parse(readFileSync(`public/library/footprints/${p.footprint}.json`, "utf8")));
  console.log(k, routingCrossings(routeBoard(spec, fps).traces));
}
