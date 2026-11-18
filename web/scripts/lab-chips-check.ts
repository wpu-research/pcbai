import { readFileSync } from "node:fs";
import { IMPORT_FOOTPRINTS, labToBoard, type LabExport } from "../src/lib/lab/import";
import { runDrc } from "../src/lib/pcb/drc";
import { proceduralFootprint } from "../src/lib/pcb/procedural";
import type { Footprint } from "../src/lib/pcb/types";

const P = (id: string, type: string) => ({ id, type, x: 0, y: 0, rotation: 0, props: {} });
let n = 0;
const W = (a: string, ap: string, b: string, bp: string) => ({ id: `w${++n}`, a: { part: a, pin: ap }, b: { part: b, pin: bp } });
const lab: LabExport = {
  v: 1, code: "// chips", circuit: {
    parts: ["uno", "l293d", "sr595", "lm7805", "rtc", "mpu6050", "ds18b20", "dht", "mosfet", "npn", "diode", "buzzer", "ldr", "pot", "max17048"].map((t) => P(t, t)),
    wires: [
      W("l293d", "VCC1", "uno", "5V"), W("l293d", "GND", "uno", "GND"), W("l293d", "IN1", "uno", "D3"), W("l293d", "EN12", "uno", "D5"),
      W("sr595", "VCC", "uno", "5V"), W("sr595", "GND", "uno", "GND"), W("sr595", "SER", "uno", "D4"), W("sr595", "SRCLK", "uno", "D6"), W("sr595", "RCLK", "uno", "D7"),
      W("rtc", "VCC", "uno", "3V3"), W("rtc", "GND", "uno", "GND2"), W("rtc", "SDA", "uno", "A4"), W("rtc", "SCL", "uno", "A5"),
      W("mpu6050", "VCC", "uno", "3V3"), W("mpu6050", "GND", "uno", "GND2"), W("mpu6050", "SDA", "uno", "A4"), W("mpu6050", "SCL", "uno", "A5"),
      W("ds18b20", "VCC", "uno", "5V"), W("ds18b20", "GND", "uno", "GND3"), W("ds18b20", "DQ", "uno", "D8"),
      W("dht", "VCC", "uno", "5V"), W("dht", "GND", "uno", "GND3"), W("dht", "DATA", "uno", "D9"),
      W("pot", "VCC", "uno", "5V"), W("pot", "GND", "uno", "GND"), W("pot", "SIG", "uno", "A0"),
      W("ldr", "1", "uno", "5V"), W("ldr", "2", "uno", "A1"),
      W("mosfet", "G", "uno", "D10"), W("mosfet", "S", "uno", "GND"), W("diode", "A", "mosfet", "D"),
      W("buzzer", "+", "uno", "D11"), W("buzzer", "-", "uno", "GND"),
    ],
  },
};
const fps = new Map<string, Footprint>();
for (const k of IMPORT_FOOTPRINTS(lab)) fps.set(k, proceduralFootprint(k) ?? JSON.parse(readFileSync(`public/library/footprints/${k}.json`, "utf8")));
const r = labToBoard(lab, { id: "chips", title: "chips", lang: "tr" }, (k) => fps.get(k)!.bbox);
console.log(`board ${r.spec.width}x${r.spec.height}  parts ${r.spec.parts.length}`);
for (const row of r.rows) console.log(`  ${row.labType.padEnd(9)} -> ${row.ref.padEnd(4)} ${row.kind.padEnd(6)} ${row.name}`);
console.log("  support:", r.spec.parts.filter((p) => p.group === "Lab" && /dekuplaj|kondansat/.test(p.name)).map((p) => p.ref).join(" "));
const net = (ref: string) => r.spec.nets.filter((n) => n.pins.some(([r2]) => r2 === ref)).map((n) => `${n.name}:${n.pins.filter(([r2]) => r2 === ref).map(([, p]) => p).join("/")}`);
const u = (t: string) => r.rows.find((x) => x.labType === t)!.ref;
console.log("  L293D nets:", net(u("l293d")).join("  "));
console.log("  MPU nets:  ", net(u("mpu6050")).join("  "));
console.log("  DRC:", runDrc(r.spec, fps).map((i) => `${i.kind}:${i.refs.join("+")}`).join(" ") || "OK");
console.log("  warnings:", r.warnings.join(" | ") || "-");
