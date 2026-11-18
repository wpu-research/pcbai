import "server-only";
import { strToU8, zipSync } from "fflate";
import { buildFabFiles, fabDrawingSvg } from "./pcb/fab";
import { serverFootprints } from "./pcb/server";
import type { BoardSpec } from "./pcb/types";

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
const safe = (s: string) => s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR[c]).replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "board";

export async function zipResponse(spec: BoardSpec, name: string, version: number, sketch = "") {
  const fps = await serverFootprints(spec);
  const files = buildFabFiles(spec, fps);
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = strToU8(f.content);
  entries[`${spec.id}-fab-drawing.svg`] = strToU8(fabDrawingSvg(spec, fps));
  if (sketch.trim()) entries[`firmware/${safe(name)}/${safe(name)}.ino`] = strToU8(sketch);
  const zip = zipSync(entries, { level: 6 });
  return new Response(new Blob([zip as BlobPart]), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${safe(name)}-rev${version}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}

export async function drawingResponse(spec: BoardSpec, name: string, download: boolean) {
  const svg = fabDrawingSvg(spec, await serverFootprints(spec));
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "cache-control": "private, no-store",
      ...(download ? { "content-disposition": `attachment; filename="${safe(name)}-drawing.svg"` } : {}),
    },
  });
}

export async function fileList(spec: BoardSpec) {
  const files = buildFabFiles(spec, await serverFootprints(spec));
  return files.map((f) => ({ name: f.name, size: new TextEncoder().encode(f.content).length }));
}
