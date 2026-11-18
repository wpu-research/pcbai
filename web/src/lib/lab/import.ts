import { FIELD_NODE } from "../pcb/boards";
import { headerKey } from "../pcb/procedural";
import type { BoardSpec, NetSpec, PartSpec } from "../pcb/types";
import { LAB_PINS } from "./pins";

/* ---------- the lab's exchange format (MacademiaX virtual lab, robotix) ---------- */

export interface LabPart {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  props: Record<string, number | string | boolean>;
}
export interface LabWire {
  id: string;
  a: { part: string; pin: string };
  b: { part: string; pin: string };
}
export interface LabExport {
  v: 1;
  source?: string;
  name?: string;
  circuit: { parts: LabPart[]; wires: LabWire[] };
  code: string;
}

export function parseLabExport(raw: unknown): LabExport | null {
  const o = raw as Partial<LabExport> | null;
  if (!o || typeof o !== "object" || !o.circuit || !Array.isArray(o.circuit.parts) || !Array.isArray(o.circuit.wires)) return null;
  const parts = o.circuit.parts
    .filter((p): p is LabPart => !!p && typeof p.id === "string" && typeof p.type === "string" && p.type in LAB_PINS)
    .slice(0, 80);
  const ids = new Set(parts.map((p) => p.id));
  const wires = o.circuit.wires
    .filter((w): w is LabWire => !!w?.a && !!w?.b && ids.has(w.a.part) && ids.has(w.b.part) && typeof w.a.pin === "string" && typeof w.b.pin === "string")
    .slice(0, 400);
  if (!parts.some((p) => p.type === "uno")) return null;
  return { v: 1, source: o.source, name: typeof o.name === "string" ? o.name.slice(0, 80) : undefined, circuit: { parts, wires }, code: typeof o.code === "string" ? o.code.slice(0, 60_000) : "" };
}

/** Lab exports travel in the URL fragment as base64url JSON (never sent to the server by the browser). */
export function decodeLabFragment(hash: string): LabExport | null {
  try {
    const b64 = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    return parseLabExport(JSON.parse(json));
  } catch {
    return null;
  }
}

export function encodeLabFragment(x: LabExport) {
  const bytes = new TextEncoder().encode(JSON.stringify(x));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------- Arduino Uno pins -> ESP32-C3-WROOM-02 pads ---------- */

/** ADC-capable IOs first for A0-A3, the I2C pair on A4/A5 (like the Uno), the rest for digital pins. */
const ANALOG: Record<string, { io: string; pad: string }> = {
  A0: { io: "IO0", pad: "18" },
  A1: { io: "IO1", pad: "17" },
  A2: { io: "IO2", pad: "16" },
  A3: { io: "IO3", pad: "15" },
  A4: { io: "IO4 (SDA)", pad: "3" },
  A5: { io: "IO5 (SCL)", pad: "4" },
};
const DIGITAL_POOL = [
  { io: "IO6", pad: "5" },
  { io: "IO7", pad: "6" },
  { io: "IO10", pad: "10" },
  { io: "IO8", pad: "7" },
  { io: "IO20", pad: "11" },
  { io: "IO21", pad: "12" },
];

/* ---------- lab parts -> board parts ---------- */

const R0402 = "Resistor_SMD_R_0402_1005Metric";
const LED0603 = "LED_SMD_LED_0603_1608Metric";
const BTN = "Button_Switch_SMD_SW_SPST_TS-1088-xR020";
const LGA8 = "Package_LGA_Bosch_LGA-8_2.5x2.5mm_P0.65mm_ClockwisePinNumbering";
const JST = "Connector_JST_JST_PH_S2B-PH-K_1x02_P2.00mm_Horizontal";

const C0402 = "Capacitor_SMD_C_0402_1005Metric";
const C0805 = "Capacitor_SMD_C_0805_2012Metric";

type Direct = {
  footprint: string;
  prefix: string;
  /** lab pin -> footprint pads; unused pins that must be tied (to ground or supply) ride along on GND/VCC */
  pads: Record<string, string[]>;
  name: { en: string; tr: string };
  /** part number for the BOM */
  mpn?: string;
  /** support parts placed next to it: footprint + lab pin -> pad of the support part */
  extras?: { footprint: string; prefix: string; pads: Record<string, string[]>; name: { en: string; tr: string } }[];
};

const decoupling = (vcc = "VCC", gnd = "GND") => ({ footprint: C0402, prefix: "C", pads: { [vcc]: ["1"], [gnd]: ["2"] }, name: { en: "100 nF decoupling", tr: "100 nF dekuplaj" } });

/** Lab pin -> footprint pad, for parts that become real components on the board (pinouts from the datasheets). */
const DIRECT: Record<string, Direct> = {
  led: { footprint: LED0603, prefix: "D", pads: { A: ["2"], K: ["1"] }, name: { en: "LED", tr: "LED" } },
  resistor: { footprint: R0402, prefix: "R", pads: { "1": ["1"], "2": ["2"] }, name: { en: "Resistor", tr: "Direnç" } },
  button: { footprint: BTN, prefix: "SW", pads: { A: ["1"], B: ["2"] }, name: { en: "Button", tr: "Buton" } },
  // Bosch LGA-8: 1 GND, 2 CSB, 3 SDI, 4 SCK, 5 SDO, 6 VDDIO, 7 GND, 8 VDD
  bme280: { footprint: LGA8, prefix: "U", mpn: "BME280", pads: { VCC: ["8", "6"], GND: ["1", "7", "5"], SDA: ["3"], SCL: ["4"] }, name: { en: "BME280 sensor", tr: "BME280 sensörü" }, extras: [decoupling()] },
  bmp280: { footprint: LGA8, prefix: "U", mpn: "BMP280", pads: { VCC: ["8", "6"], GND: ["1", "7", "5"], SDA: ["3"], SCL: ["4"] }, name: { en: "BMP280 sensor", tr: "BMP280 sensörü" }, extras: [decoupling()] },
  battery: { footprint: JST, prefix: "J", pads: { "+": ["1"], "-": ["2"] }, name: { en: "Battery connector", tr: "Pil soketi" } },
  // 1N4148W, SOD-123: 1 K, 2 A
  diode: { footprint: "Diode_SMD_D_SOD-123", prefix: "D", mpn: "1N4148W", pads: { A: ["2"], K: ["1"] }, name: { en: "Diode 1N4148W", tr: "Diyot 1N4148W" } },
  // MMBT2222A, SOT-23: 1 B, 2 E, 3 C
  npn: { footprint: "Package_TO_SOT_SMD_SOT-23", prefix: "Q", mpn: "MMBT2222A", pads: { B: ["1"], E: ["2"], C: ["3"] }, name: { en: "NPN transistor MMBT2222A", tr: "NPN transistör MMBT2222A" } },
  // AO3400A, SOT-23: 1 G, 2 S, 3 D
  mosfet: { footprint: "Package_TO_SOT_SMD_SOT-23", prefix: "Q", mpn: "AO3400A", pads: { G: ["1"], S: ["2"], D: ["3"] }, name: { en: "N-MOSFET AO3400A", tr: "N-MOSFET AO3400A" } },
  // L293D, DIP-16: 1 EN1,2 1A,3 1Y,4/5/12/13 GND,6 2Y,7 2A,8 VCC2,9 EN2,10 3A,11 3Y,14 4Y,15 4A,16 VCC1
  l293d: {
    footprint: "Package_DIP_DIP-16_W7.62mm", prefix: "U", mpn: "L293D",
    pads: { EN12: ["1"], IN1: ["2"], OUT1: ["3"], GND: ["4", "5", "12", "13"], OUT2: ["6"], IN2: ["7"], VCC2: ["8"], EN34: ["9"], IN3: ["10"], OUT3: ["11"], OUT4: ["14"], IN4: ["15"], VCC1: ["16"] },
    name: { en: "Motor driver L293D", tr: "Motor sürücü L293D" }, extras: [decoupling("VCC1"), decoupling("VCC2")],
  },
  // 74HC595, SOIC-16: 1 QB..7 QH, 8 GND, 9 QH', 10 SRCLR, 11 SRCLK, 12 RCLK, 13 OE, 14 SER, 15 QA, 16 VCC
  sr595: {
    footprint: "Package_SO_SOIC-16_3.9x9.9mm_P1.27mm", prefix: "U", mpn: "74HC595D",
    pads: { QB: ["1"], QC: ["2"], QD: ["3"], QE: ["4"], QF: ["5"], QG: ["6"], QH: ["7"], GND: ["8"], QH_: ["9"], SRCLR: ["10"], SRCLK: ["11"], RCLK: ["12"], OE: ["13"], SER: ["14"], QA: ["15"], VCC: ["16"] },
    name: { en: "Shift register 74HC595", tr: "Kaydırmalı yazmaç 74HC595" }, extras: [decoupling()],
  },
  // L7805CDT, DPAK: 1 IN, 2 GND (tab), 3 OUT
  lm7805: {
    footprint: "Package_TO_SOT_SMD_TO-252-2", prefix: "U", mpn: "L7805CDT", pads: { IN: ["1"], GND: ["2"], OUT: ["3"] }, name: { en: "5 V regulator 7805", tr: "5 V regülatör 7805" },
    extras: [
      { footprint: C0805, prefix: "C", pads: { IN: ["1"], GND: ["2"] }, name: { en: "330 nF input cap", tr: "330 nF giriş kondansatörü" } },
      { footprint: C0805, prefix: "C", pads: { OUT: ["1"], GND: ["2"] }, name: { en: "100 nF output cap", tr: "100 nF çıkış kondansatörü" } },
    ],
  },
  // DS3231SN, SOIC-16W: 2 VCC, 13 GND, 14 VBAT (grounded when unused), 15 SDA, 16 SCL
  rtc: { footprint: "Package_SO_SOIC-16W_7.5x10.3mm_P1.27mm", prefix: "U", mpn: "DS3231SN", pads: { VCC: ["2"], GND: ["13", "14"], SDA: ["15"], SCL: ["16"] }, name: { en: "Real-time clock DS3231", tr: "Gerçek zamanlı saat DS3231" }, extras: [decoupling()] },
  // MPU-6050, QFN-24: 8 VLOGIC, 13 VDD, 18 GND; AD0 (9), FSYNC (11), CLKIN (1) to ground; 23 SCL, 24 SDA
  mpu6050: { footprint: "Sensor_Motion_InvenSense_QFN-24_4x4mm_P0.5mm", prefix: "U", mpn: "MPU-6050", pads: { VCC: ["13", "8"], GND: ["18", "9", "11", "1"], SDA: ["24"], SCL: ["23"] }, name: { en: "Motion sensor MPU-6050", tr: "Hareket sensörü MPU-6050" }, extras: [decoupling()] },
  // DS18B20, TO-92: 1 GND, 2 DQ, 3 VDD
  ds18b20: { footprint: "Package_TO_SOT_THT_TO-92_Inline", prefix: "U", mpn: "DS18B20", pads: { GND: ["1"], DQ: ["2"], VCC: ["3"] }, name: { en: "Temperature sensor DS18B20", tr: "Sıcaklık sensörü DS18B20" } },
  // DHT11/DHT22 body: 1 VDD, 2 DATA, 3 NC, 4 GND
  dht: { footprint: "Sensor_Aosong_DHT11_5.5x12.0_P2.54mm", prefix: "U", mpn: "DHT11", pads: { VCC: ["1"], DATA: ["2"], GND: ["4"] }, name: { en: "Humidity sensor DHT", tr: "Nem sensörü DHT" } },
  buzzer: { footprint: "Buzzer_Beeper_Buzzer_12x9.5RM7.6", prefix: "BZ", mpn: "Buzzer 12x9.5", pads: { "+": ["1"], "-": ["2"] }, name: { en: "Buzzer", tr: "Buzzer" } },
  ldr: { footprint: "OptoDevice_R_LDR_5.1x4.3mm_P3.4mm_Vertical", prefix: "R", mpn: "GL5528", pads: { "1": ["1"], "2": ["2"] }, name: { en: "Light sensor (LDR)", tr: "Işık sensörü (LDR)" } },
  ntc: { footprint: "Resistor_SMD_R_0603_1608Metric", prefix: "TH", mpn: "NTC 10k 0603", pads: { "1": ["1"], "2": ["2"] }, name: { en: "Thermistor (NTC)", tr: "Termistör (NTC)" } },
  // Bourns 3386W: 1 and 3 the ends, 2 the wiper
  pot: { footprint: "Potentiometer_THT_Potentiometer_Bourns_3386W_Horizontal", prefix: "RV", mpn: "3386W-1-103", pads: { VCC: ["1"], SIG: ["2"], GND: ["3"] }, name: { en: "Trimmer 10k", tr: "Trimpot 10k" } },
  // MAX17048, TDFN-8: 1 CTG, 2 CELL, 3 VDD, 4 GND, 5 ALRT, 6 QSTRT, 7 SCL, 8 SDA, 9 EP; CTG/QSTRT/EP grounded
  max17048: { footprint: "Package_DFN_QFN_DFN-8-1EP_2x2mm_P0.5mm_EP0.9x1.3mm", prefix: "U", mpn: "MAX17048G+", pads: { CELL: ["2", "3"], GND: ["4", "1", "6", "9"], SDA: ["8"], SCL: ["7"] }, name: { en: "Fuel gauge MAX17048", tr: "Pil seviye ölçer MAX17048" }, extras: [decoupling("CELL")] },
};

const MODULE_NAMES: Record<string, string> = {
  pot: "Potentiometer",
  ldr: "LDR",
  ntc: "NTC",
  buzzer: "Buzzer",
  servo: "Servo",
  hcsr04: "HC-SR04",
  dht: "DHT",
  pir: "PIR",
  oled: "OLED",
  lcdI2c: "LCD I2C",
  lcd1602: "LCD 1602",
  mpu6050: "MPU6050",
  rtc: "RTC",
  ds18b20: "DS18B20",
  vl53l0x: "VL53L0X",
  hc05: "HC-05",
  relay: "Relay",
  joystick: "Joystick",
  encoder: "Encoder",
  keypad: "Keypad",
};
const moduleName = (type: string) => MODULE_NAMES[type] ?? type.toUpperCase();

export interface ImportRow {
  labId: string;
  labType: string;
  ref: string;
  footprint: string;
  kind: "mcu" | "part" | "socket";
  name: string;
}
export interface ImportResult {
  spec: BoardSpec;
  rows: ImportRow[];
  pinMap: { uno: string; esp: string }[];
  warnings: string[];
  sketch: string;
}

const isGround = (pin: string) => /^GND/.test(pin) || pin === "-";

/**
 * Turn a lab circuit into a board: the reference board's USB-C, protection, regulator and boot/reset
 * stay; the Uno becomes the ESP32-C3 module; lab parts become components or module sockets,
 * packed into the free area left of the module. Wires become nets.
 */
/** Every footprint an import can use, so callers can load them before converting. */
export const IMPORT_FOOTPRINTS = (lab: LabExport) => [
  ...new Set([...FIELD_NODE.parts.map((p) => p.footprint), ...lab.circuit.parts.flatMap((p) => (DIRECT[p.type] ? [DIRECT[p.type].footprint, ...(DIRECT[p.type].extras ?? []).map((x) => x.footprint)] : [headerKey((LAB_PINS[p.type] ?? []).length)]))]),
];

export function labToBoard(
  lab: LabExport,
  opts: { id: string; title: string; lang?: "en" | "tr" },
  bbox: (footprint: string) => [number, number, number, number],
): ImportResult {
  const tr = opts.lang === "tr";
  const warnings: string[] = [];
  const parts = lab.circuit.parts;
  const hasBattery = parts.some((p) => p.type === "battery");

  /* nets from wires (union-find over "partId:pin"; the Uno's grounds are one node) */
  const parent = new Map<string, string>();
  const key = (part: string, pin: string) => {
    const p = parts.find((x) => x.id === part);
    return `${part}:${p?.type === "uno" && isGround(pin) ? "GND" : pin}`;
  };
  const find = (k: string): string => {
    if (!parent.has(k)) parent.set(k, k);
    const r = parent.get(k)!;
    if (r === k) return k;
    const root = find(r);
    parent.set(k, root);
    return root;
  };
  for (const w of lab.circuit.wires) parent.set(find(key(w.a.part, w.a.pin)), find(key(w.b.part, w.b.pin)));

  /* base: power, USB, radio module from the reference board */
  const keep = new Set(["U1", "J1", "U5", "U3", "C3", "C4", "C5", "R2", "C6", "SW1", "SW2", "R6", "R7", "C1"]);
  if (hasBattery) ["U2", "C2", "R1"].forEach((r) => keep.add(r));
  const base = FIELD_NODE.parts.filter((p) => keep.has(p.ref)).map((p) => ({ ...p }));
  // boot/reset move under the module so the left area is free for lab parts
  const moved: Record<string, [number, number]> = { SW1: [45, 37.5], SW2: [53, 37.5] };
  for (const p of base) if (moved[p.ref]) [p.x, p.y] = moved[p.ref];
  const rows: ImportRow[] = [];
  const uno = parts.find((p) => p.type === "uno")!;
  rows.push({ labId: uno.id, labType: "uno", ref: "U1", footprint: base.find((p) => p.ref === "U1")!.footprint, kind: "mcu", name: tr ? "ESP32-C3 modül (Uno'nun yerine)" : "ESP32-C3 module (replaces the Uno)" });

  /* Uno pin assignment, in order of use */
  const used = new Set<string>();
  for (const w of lab.circuit.wires) for (const e of [w.a, w.b]) if (e.part === uno.id) used.add(e.pin);
  const pool = [...DIGITAL_POOL];
  const unoPad = new Map<string, { io: string; pad: string } | "3V3" | "5V" | "GND">();
  const pinMap: ImportResult["pinMap"] = [];
  for (const pin of LAB_PINS.uno) {
    if (!used.has(pin)) continue;
    if (isGround(pin)) unoPad.set(pin, "GND");
    else if (pin === "3V3") unoPad.set(pin, "3V3");
    else if (pin === "5V" || pin === "VIN") unoPad.set(pin, "5V");
    else if (ANALOG[pin]) {
      unoPad.set(pin, ANALOG[pin]);
      pinMap.push({ uno: pin, esp: ANALOG[pin].io });
    } else if (pin === "D0" || pin === "D1") {
      warnings.push(tr ? `${pin} Uno'da seri porttur; kartta USB seri kullanılır, bu bağlantı atlandı.` : `${pin} is the Uno's serial port; the board uses USB serial, so this connection was skipped.`);
    } else {
      const next = pool.shift();
      if (next) {
        unoPad.set(pin, next);
        pinMap.push({ uno: pin, esp: next.io });
      } else warnings.push(tr ? `${pin} için boş pin kalmadı; daha büyük bir modül (ESP32-S3) gerekir.` : `No free pin left for ${pin}; this needs a larger module (ESP32-S3).`);
    }
  }

  /* lab parts -> board parts */
  const counters: Record<string, number> = { D: 1, R: 10, SW: 3, U: 6, J: 3, Q: 1, C: 20, BZ: 1, TH: 1, RV: 1 };
  const added: (PartSpec & { labId: string; pads: Record<string, string[]> })[] = [];
  for (const p of parts) {
    if (p.type === "uno") continue;
    const d = DIRECT[p.type];
    const pins = LAB_PINS[p.type] ?? [];
    if (d) {
      const ref = `${d.prefix}${counters[d.prefix]++}`;
      added.push({ ref, footprint: d.footprint, x: 0, y: 0, rot: 0, name: tr ? d.name.tr : d.name.en, group: "Lab", labId: p.id, pads: d.pads });
      rows.push({ labId: p.id, labType: p.type, ref, footprint: d.footprint, kind: "part", name: (tr ? d.name.tr : d.name.en) + (d.mpn && !(tr ? d.name.tr : d.name.en).includes(d.mpn) ? ` (${d.mpn})` : "") });
      for (const x of d.extras ?? []) {
        const xref = `${x.prefix}${counters[x.prefix]++}`;
        added.push({ ref: xref, footprint: x.footprint, x: 0, y: 0, rot: 0, name: tr ? x.name.tr : x.name.en, group: "Lab", labId: p.id, pads: x.pads });
      }
    } else {
      const ref = `J${counters.J++}`;
      const pads = Object.fromEntries(pins.map((pin, i) => [pin, [String(i + 1)]]));
      const name = `${moduleName(p.type)} ${tr ? "soketi" : "socket"} (${pins.length}p)`;
      added.push({ ref, footprint: headerKey(pins.length), x: 0, y: 0, rot: 0, name, group: "Lab", labId: p.id, pads });
      rows.push({ labId: p.id, labType: p.type, ref, footprint: headerKey(pins.length), kind: "socket", name });
    }
  }

  /* placement: shelf-pack into the free area left of the module, growing the board downwards */
  // real courtyard of each footprint: width/height and the offset from the box centre to the origin
  const size = (fp: string) => {
    const [x0, y0, x1, y1] = bbox(fp);
    return { w: x1 - x0, h: y1 - y0, dx: -(x0 + x1) / 2, dy: -(y0 + y1) / 2 };
  };
  const GAP = 1.6, X0 = 9, XNARROW = 37.5;
  let x = X0, y = 27.5, rowH = 0, wideY = 41;
  const order = [...added].sort((a, b) => size(b.footprint).h - size(a.footprint).h || size(b.footprint).w - size(a.footprint).w);
  for (const p of order) {
    const s = size(p.footprint);
    const offset = { dx: s.dx, dy: s.dy };
    if (s.w > XNARROW - X0) {
      // too wide for the left area: its own row under the module
      const yy = Math.max(wideY, y + rowH + GAP);
      p.x = X0 + s.w / 2 + offset.dx;
      p.y = yy + s.h / 2 + offset.dy;
      wideY = yy + s.h + GAP;
      y = Math.max(y, wideY - rowH - GAP);
      continue;
    }
    if (x + s.w > XNARROW) {
      x = X0;
      y += rowH + GAP;
      rowH = 0;
    }
    p.x = x + s.w / 2 + offset.dx;
    p.y = y + s.h / 2 + offset.dy;
    x += s.w + GAP;
    rowH = Math.max(rowH, s.h);
  }
  const bottom = Math.max(y + rowH, wideY - GAP, 39.25);
  const height = Math.max(40, Math.ceil(bottom + 5.5));
  if (added.length > 40) warnings.push(tr ? "Çok sayıda parça var; yerleşimi editörde gözden geçir." : "Many parts; review the placement in the editor.");

  /* nets */
  const ESP = "U1";
  const padFor = (part: string, pin: string): [string, string][] => {
    if (part === uno.id) {
      const m = unoPad.get(isGround(pin) ? pin : pin);
      if (!m) return [];
      if (m === "GND") return [[ESP, "9"]];
      if (m === "3V3") return [[ESP, "1"]];
      if (m === "5V") return [["C1", "1"]]; // USB 5 V rail (VBUS) after the protection
      return [[ESP, m.pad]];
    }
    // a lab part may become several board parts (a chip and its decoupling caps)
    return added.filter((x) => x.labId === part).flatMap((a) => (a.pads[pin] ?? []).map((pad) => [a.ref, pad] as [string, string]));
  };
  const groups = new Map<string, { pins: [string, string][]; ground: boolean; power: boolean; label: string }>();
  for (const k of parent.keys()) {
    const root = find(k);
    const [part, pin] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
    const g = groups.get(root) ?? { pins: [], ground: false, power: false, label: "" };
    const lp = parts.find((x) => x.id === part);
    if (isGround(pin) || (lp?.type !== "uno" && pin === "GND")) g.ground = true;
    if (lp?.type === "uno" && ["5V", "3V3", "VIN"].includes(pin)) g.power = true;
    if (lp?.type === "battery" && pin === "+") g.power = true;
    if (lp?.type === "uno" && !g.label) g.label = pin;
    g.pins.push(...padFor(part, pin));
    groups.set(root, g);
  }
  const labNets: NetSpec[] = [];
  let n = 1;
  for (const g of groups.values()) {
    const pins = [...new Map(g.pins.map((p) => [p.join("."), p])).values()];
    if (pins.length < 2 && !g.ground) continue;
    labNets.push({
      name: g.ground ? "GND" : `LAB_${g.label || n}`,
      kind: g.ground ? "ground" : g.power ? "power" : "signal",
      width: g.ground ? 0.4 : g.power ? 0.4 : 0.25,
      pins,
    });
    n++;
  }

  /* base nets, rewired for the parts that stay (VBUS feeds the regulator when there is no cell) */
  const baseNets: NetSpec[] = [
    { name: "VBUS", kind: "power", width: 0.5, pins: hasBattery ? [["J1", "A4"], ["U5", "5"], ["C1", "1"], ["U2", "4"]] : [["J1", "A4"], ["U5", "5"], ["C1", "1"], ["U3", "1"], ["C3", "1"]] },
    ...(hasBattery
      ? [
          { name: "VBAT", kind: "power", width: 0.5, pins: [["U2", "3"], ["C2", "1"], ["U3", "1"], ["C3", "1"]] } as NetSpec,
          { name: "PROG", kind: "signal", width: 0.25, pins: [["U2", "5"], ["R1", "1"]] } as NetSpec,
        ]
      : []),
    { name: "EN_LDO", kind: "signal", width: 0.25, pins: [["U3", "1"], ["U3", "3"]] },
    { name: "3V3", kind: "power", width: 0.4, pins: [["U3", "5"], ["C4", "1"], ["C5", "1"], ["U1", "1"]] },
    { name: "PU", kind: "power", width: 0.3, pins: [["R2", "1"], ["C5", "1"]] },
    { name: "EN", kind: "signal", width: 0.25, pins: [["R2", "2"], ["C6", "1"]] },
    { name: "EN_M", kind: "signal", width: 0.25, pins: [["R2", "2"], ["U1", "2"]] },
    { name: "RST", kind: "signal", width: 0.25, pins: [["U1", "10"], ["SW2", "2"]] },
    { name: "BOOT", kind: "signal", width: 0.25, pins: [["U1", "8"], ["SW1", "2"]] },
    { name: "D+", kind: "usb", width: 0.3, pins: [["J1", "A6"], ["U5", "1"], ["U1", "14"]] },
    { name: "D-", kind: "usb", width: 0.3, pins: [["J1", "A7"], ["U5", "3"], ["U1", "13"]] },
    { name: "CC1", kind: "signal", width: 0.25, pins: [["J1", "A5"], ["R6", "2"]] },
    { name: "CC2", kind: "signal", width: 0.25, pins: [["J1", "B5"], ["R7", "2"]] },
    {
      name: "GND",
      kind: "ground",
      width: 0.4,
      pins: [["J1", "A1"], ["U5", "2"], ["C1", "2"], ["U3", "2"], ["C3", "2"], ["C5", "2"], ["C6", "2"], ["U1", "9"], ["R6", "1"], ["R7", "1"], ["SW1", "1"], ["SW2", "1"], ...(hasBattery ? ([["U2", "2"], ["C2", "2"], ["R1", "2"]] as [string, string][]) : [])],
    },
  ];
  // the boot strap uses IO9 and the I2C pair IO4/IO5: drop clashing lab pads from the base if a lab net already uses them
  const spec: BoardSpec = {
    ...FIELD_NODE,
    id: opts.id,
    title: opts.title,
    height,
    holes: FIELD_NODE.holes.map((h) => (h.y > FIELD_NODE.height / 2 ? { ...h, y: height - (FIELD_NODE.height - h.y) } : h)),
    parts: [...base, ...added.map(({ labId: _l, pads: _p, ...p }) => (void _l, void _p, p))],
    nets: [...baseNets, ...labNets],
  };

  /* the sketch, with the pin changes written at the top */
  const header = [
    `// ${opts.title} — ${tr ? "MacademiaX sanal laboratuvarından aktarıldı" : "imported from the MacademiaX virtual lab"}`,
    `// ${tr ? "Kart: ESP32-C3. Uno pinlerinin karşılıkları:" : "Board: ESP32-C3. Uno pins map to:"}`,
    ...pinMap.map((m) => `//   ${m.uno.padEnd(4)} -> ${m.esp}`),
    `// ${tr ? "Kodu çalıştırmadan önce pin numaralarını bu tabloya göre güncelle." : "Update the pin numbers in the code to this table before flashing."}`,
    "",
  ].join("\n");
  return { spec, rows, pinMap, warnings, sketch: header + lab.code };
}
