// Builds the presentation as ONE self-contained HTML file: JS, CSS, footprints and 3D models inlined.
// Usage: node deck/build.mjs   -> public/sunum.html (served by the site) and ../sunum.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lib = join(root, "public/library");

// 1. JS bundle
const js = await build({
  entryPoints: [join(root, "src/deck/main.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  alias: { "@": join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_LIBRARY_BASE": '""' },
  logLevel: "warning",
  legalComments: "none",
});
const bundle = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// 2. Tailwind CSS
const tmp = mkdtempSync(join(tmpdir(), "deck-"));
execFileSync(join(root, "node_modules/.bin/tailwindcss"), ["-i", join(root, "src/deck/deck.css"), "-o", join(tmp, "deck.css"), "--minify"], { cwd: root, stdio: "inherit" });
const css = readFileSync(join(tmp, "deck.css"), "utf8");

// 3. Library: footprints as JSON, full-detail models as data URIs (the .lo variants fall back to these)
const footprints = {};
for (const f of readdirSync(join(lib, "footprints"))) footprints[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(lib, "footprints", f), "utf8"));
const models = {};
// only the models the deck's boards use (the library holds many more)
const used = readFileSync(join(root, "src/lib/pcb/boards.ts"), "utf8");
for (const f of readdirSync(join(lib, "models"))) {
  if (f.endsWith(".lo.glb")) continue;
  if (!used.includes(f.replace(/\.glb$/, "").replace(/^[^_]+_[^_]+_/, "")) && !used.includes(f.replace(/\.glb$/, ""))) continue;
  models[f] = "data:model/gltf-binary;base64," + readFileSync(join(lib, "models", f)).toString("base64");
}
const libJson = JSON.stringify({ footprints, models }).replace(/<\//g, "<\\/");

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pcbai × MacademiaX · Sunum</title>
<meta name="description" content="Simülasyonda çalışan devreden kapıya gelen dizili karta: sanal laboratuvar, yapay zekâ ile PCB tasarımı, 3D önizleme, dizgi hattı ve kargo.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Azeret+Mono:wght@300;400;500&family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
<style>:root{--font-archivo:"Archivo";--font-azeret:"Azeret Mono";--font-outfit:"Outfit"}</style>
<style>${css}</style>
</head>
<body class="min-h-dvh bg-g-1 text-t-1">
<div id="root"></div>
<noscript>Bu sunum JavaScript ve WebGL gerektirir.</noscript>
<script>window.__PCBAI_LIB=${libJson};</script>
<script>${bundle}</script>
</body>
</html>
`;

writeFileSync(join(root, "public/sunum.html"), html);
writeFileSync(join(root, "../sunum.html"), html);
console.log(`sunum.html: ${(html.length / 1024).toFixed(0)} KB (js ${(bundle.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB, library ${(libJson.length / 1024).toFixed(0)} KB)`);
