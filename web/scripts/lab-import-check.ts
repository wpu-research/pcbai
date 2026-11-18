import { readFileSync } from "node:fs";
import { IMPORT_FOOTPRINTS, labToBoard, type LabExport } from "../src/lib/lab/import";
import { routingCrossings, runDrc } from "../src/lib/pcb/drc";
import { routeBoard } from "../src/lib/pcb/geometry";
import { proceduralFootprint } from "../src/lib/pcb/procedural";
import type { Footprint } from "../src/lib/pcb/types";

const P = (id: string, type: string) => ({ id, type, x: 0, y: 0, rotation: 0, props: {} });
const W = (i: number, a: string, ap: string, b: string, bp: string) => ({ id: `w${i}`, a: { part: a, pin: ap }, b: { part: b, pin: bp } });
const cases: Record<string, LabExport> = {
  blink: { v: 1, code: "void setup(){pinMode(13,OUTPUT);}\nvoid loop(){}", circuit: { parts: [P("uno", "uno"), P("l1", "led"), P("r1", "resistor")], wires: [W(1, "uno", "D13", "r1", "1"), W(2, "r1", "2", "l1", "A"), W(3, "l1", "K", "uno", "GND")] } },
  weather: {
    v: 1, code: "// weather", circuit: {
      parts: [P("uno", "uno"), P("s", "bme280"), P("o", "oled"), P("b", "button"), P("z", "buzzer"), P("l", "led"), P("r", "resistor")],
      wires: [W(1, "s", "VCC", "uno", "3V3"), W(2, "s", "GND", "uno", "GND"), W(3, "s", "SDA", "uno", "A4"), W(4, "s", "SCL", "uno", "A5"),
        W(5, "o", "VCC", "uno", "3V3"), W(6, "o", "GND", "uno", "GND2"), W(7, "o", "SDA", "uno", "A4"), W(8, "o", "SCL", "uno", "A5"),
        W(9, "b", "A", "uno", "D2"), W(10, "b", "B", "uno", "GND"), W(11, "z", "+", "uno", "D8"), W(12, "z", "-", "uno", "GND3"),
        W(13, "uno", "D9", "r", "1"), W(14, "r", "2", "l", "A"), W(15, "l", "K", "uno", "GND")],
    },
  },
  big: {
    v: 1, code: "// big", circuit: {
      parts: [P("uno", "uno"), P("lcd", "lcd1602"), P("hc", "hcsr04"), P("sv", "servo"), P("dht", "dht"), P("bat", "battery"), P("pot", "pot")],
      wires: [W(1, "hc", "TRIG", "uno", "D3"), W(2, "hc", "ECHO", "uno", "D4"), W(3, "hc", "VCC", "uno", "5V"), W(4, "hc", "GND", "uno", "GND"),
        W(5, "sv", "SIG", "uno", "D5"), W(6, "sv", "VCC", "uno", "5V"), W(7, "sv", "GND", "uno", "GND"), W(8, "dht", "DATA", "uno", "D6"),
        W(9, "pot", "SIG", "uno", "A0"), W(10, "lcd", "RS", "uno", "D7"), W(11, "lcd", "E", "uno", "D10"), W(12, "lcd", "D4", "uno", "D11"), W(13, "lcd", "D5", "uno", "D12"),
        W(14, "bat", "+", "uno", "VIN"), W(15, "bat", "-", "uno", "GND")],
    },
  },
};
for (const [name, lab] of Object.entries(cases)) {
  const fps = new Map<string, Footprint>();
  for (const k of IMPORT_FOOTPRINTS(lab)) fps.set(k, proceduralFootprint(k) ?? JSON.parse(readFileSync(`public/library/footprints/${k}.json`, "utf8")));
  const r = labToBoard(lab, { id: name, title: name, lang: "tr" }, (k) => fps.get(k)!.bbox);
  const drc = runDrc(r.spec, fps);
  console.log(`${name}: ${r.spec.width}x${r.spec.height} parts=${r.spec.parts.length} nets=${r.spec.nets.length} drc=${drc.map((i) => i.kind + ":" + i.refs.join("+")).join(" ") || "OK"} crossings=${routingCrossings(routeBoard(r.spec, fps).traces)}`);
  console.log("  pins:", r.pinMap.map((m) => `${m.uno}->${m.esp}`).join(", "), r.warnings.length ? "| " + r.warnings.join(" ") : "");
}
