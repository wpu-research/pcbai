import { encodeLabFragment, type LabExport } from "../src/lib/lab/import";
const P = (id: string, type: string) => ({ id, type, x: 0, y: 0, rotation: 0, props: {} });
let n = 0;
const W = (a: string, ap: string, b: string, bp: string) => ({ id: `w${++n}`, a: { part: a, pin: ap }, b: { part: b, pin: bp } });
const lab: LabExport = { v: 1, name: "Çip testi", code: "// chips", circuit: {
  parts: ["uno", "l293d", "sr595", "lm7805", "rtc", "mpu6050", "ds18b20", "dht", "mosfet", "diode", "buzzer", "ldr", "pot"].map((t) => P(t, t)),
  wires: [W("l293d", "VCC1", "uno", "5V"), W("l293d", "GND", "uno", "GND"), W("l293d", "IN1", "uno", "D3"), W("sr595", "VCC", "uno", "5V"), W("sr595", "GND", "uno", "GND"), W("sr595", "SER", "uno", "D4"),
    W("rtc", "VCC", "uno", "3V3"), W("rtc", "GND", "uno", "GND2"), W("rtc", "SDA", "uno", "A4"), W("rtc", "SCL", "uno", "A5"), W("mpu6050", "VCC", "uno", "3V3"), W("mpu6050", "GND", "uno", "GND2"),
    W("mpu6050", "SDA", "uno", "A4"), W("mpu6050", "SCL", "uno", "A5"), W("ds18b20", "VCC", "uno", "5V"), W("ds18b20", "DQ", "uno", "D8"), W("dht", "DATA", "uno", "D9"), W("pot", "SIG", "uno", "A0"),
    W("ldr", "2", "uno", "A1"), W("mosfet", "G", "uno", "D10"), W("diode", "A", "mosfet", "D"), W("buzzer", "+", "uno", "D11")] } };
console.log(encodeLabFragment(lab));
