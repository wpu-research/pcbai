// Generate fabrication files for a reference board and sanity-check them.
// Usage: node scripts/fab-check.mjs [outDir] [BOARD_EXPORT=FIELD_NODE]
import { build } from "esbuild";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] ?? join(tmpdir(), "pcbai-fab-out");
const board = process.argv[3] ?? "FIELD_NODE";

// Bundle the TS sources (incl. three) into a temporary ESM module and import it.
const bundle = join(tmpdir(), `pcbai-fab-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from "./src/lib/pcb/fab"; export * as boards from "./src/lib/pcb/boards";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle,
  logLevel: "warning",
});
const { buildFabFiles, loadFootprintsFromDisk, fabDrawingSvg, boards } = await import(pathToFileURL(bundle).href);
await rm(bundle, { force: true });

const spec = boards[board];
if (!spec) throw new Error(`no board export ${board}`);
const fps = await loadFootprintsFromDisk(spec, join(root, "public/library/footprints"));
const files = buildFabFiles(spec, fps);
files.push({ name: `${spec.id}-fab-drawing.svg`, content: fabDrawingSvg(spec, fps), mime: "image/svg+xml" });

await mkdir(outDir, { recursive: true });
let failed = 0;
const fail = (msg) => (failed++, console.error("FAIL", msg));
for (const f of files) {
  await writeFile(join(outDir, f.name), f.content);
  console.log(`${String(f.content.length).padStart(8)}  ${f.name}`);
  if (f.name.endsWith(".gbr")) {
    if (!f.content.includes("%FSLAX46Y46*%") || !f.content.includes("%MOMM*%")) fail(`${f.name}: header`);
    if (!f.content.trimEnd().endsWith("M02*")) fail(`${f.name}: missing M02`);
    if (/NaN|undefined|Infinity/.test(f.content)) fail(`${f.name}: bad number`);
    if ((f.content.match(/G36\*/g) ?? []).length !== (f.content.match(/G37\*/g) ?? []).length) fail(`${f.name}: G36/G37`);
    for (const m of f.content.matchAll(/X(-?\d+)Y(-?\d+)D0[123]/g)) {
      const x = +m[1] / 1e6, y = +m[2] / 1e6;
      if (x < -0.01 || y < -0.01 || x > spec.width + 0.01 || y > spec.height + 0.01) {
        const msg = `${f.name}: point off board ${x},${y}`;
        // silkscreen of overhanging connectors legitimately runs past the edge; fabs clip it
        if (f.name.includes("Silkscreen")) console.warn("warn", msg);
        else fail(msg);
        break;
      }
    }
  }
  if (f.name.endsWith(".drl") && (!f.content.startsWith("M48") || !f.content.trimEnd().endsWith("M30"))) fail(`${f.name}: excellon framing`);
}
console.log(failed ? `${failed} check(s) failed` : `ok — ${files.length} files in ${outDir}`);
process.exit(failed ? 1 : 0);
