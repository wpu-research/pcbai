import { readFileSync } from "node:fs";
import { runDrc } from "../src/lib/pcb/drc";
import { TEMPLATES } from "../src/lib/pcb/templates";
import type { Footprint } from "../src/lib/pcb/types";
for (const [k, spec] of Object.entries(TEMPLATES)) {
  const fps = new Map<string, Footprint>();
  for (const p of spec.parts) fps.set(p.footprint, JSON.parse(readFileSync(`public/library/footprints/${p.footprint}.json`, "utf8")));
  const issues = runDrc(spec, fps);
  console.log(k, issues.length ? issues.map((i) => `${i.kind}:${i.refs.join("+")}`).join(" ") : "OK");
}
