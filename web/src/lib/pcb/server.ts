import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { proceduralFootprint } from "./procedural";
import type { BoardSpec, Footprint } from "./types";

const cache = new Map<string, Footprint>();

/** Footprints for a design, read from public/library on the server. */
export const serverFootprints = (spec: BoardSpec) => footprintsByKey(spec.parts.map((p) => p.footprint));

export async function footprintsByKey(keys: string[]) {
  const map = new Map<string, Footprint>();
  for (const k of new Set(keys)) {
    let fp = cache.get(k) ?? proceduralFootprint(k) ?? undefined;
    if (!fp) {
      fp = JSON.parse(await readFile(path.join(process.cwd(), "public/library/footprints", `${k}.json`), "utf8")) as Footprint;
      cache.set(k, fp);
    }
    map.set(k, fp);
  }
  return map;
}
