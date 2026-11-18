import type { BoardSpec } from "./types";

const ESP = "RF_Module_ESP32-C3-WROOM-02";
const USBC = "Connector_USB_USB_C_Receptacle_GCT_USB4105-xx-A_16P_TopMnt_Horizontal";
const JST = "Connector_JST_JST_PH_S2B-PH-K_1x02_P2.00mm_Horizontal";
const SOT5 = "Package_TO_SOT_SMD_SOT-23-5";
const SOT6 = "Package_TO_SOT_SMD_SOT-23-6";
const LGA8 = "Package_LGA_Bosch_LGA-8_2.5x2.5mm_P0.65mm_ClockwisePinNumbering";
const XTAL = "Crystal_Crystal_SMD_3215-2Pin_3.2x1.5mm";
const BTN = "Button_Switch_SMD_SW_SPST_TS-1088-xR020";
const LED = "LED_SMD_LED_0603_1608Metric";
const C0402 = "Capacitor_SMD_C_0402_1005Metric";
const C0603 = "Capacitor_SMD_C_0603_1608Metric";
const C0805 = "Capacitor_SMD_C_0805_2012Metric";
const R0402 = "Resistor_SMD_R_0402_1005Metric";

/** Our reference design: a battery-powered ESP32-C3 environment node, 70 × 40 mm. */
export const FIELD_NODE: BoardSpec = {
  id: "field-node",
  title: "Wi-Fi environment node",
  width: 70,
  height: 40,
  radius: 2.5,
  thickness: 1.6,
  finish: { mask: "black", silk: "white", surface: "enig" },
  holes: [
    { x: 4, y: 4, d: 3.2 },
    { x: 66, y: 4, d: 3.2 },
    { x: 4, y: 36, d: 3.2 },
    { x: 66, y: 36, d: 3.2 },
  ],
  parts: [
    { ref: "U1", footprint: ESP, x: 45.5, y: 20, rot: 90, name: "Wi-Fi + BLE module", does: "Runs the firmware, talks to the cloud", group: "Radio", label: true },
    { ref: "J1", footprint: USBC, x: 4.5, y: 20, rot: 90, name: "USB-C", does: "Charging and flashing", group: "Power in", label: true },
    { ref: "J2", footprint: JST, x: 12, y: 5.5, rot: 180, name: "Battery", does: "1S Li-ion cell", group: "Power in", label: true },
    { ref: "U2", footprint: SOT5, x: 17, y: 12, rot: 0, name: "Li-ion charger", does: "Charges the cell from USB", group: "Charger" },
    { ref: "U3", footprint: SOT5, x: 26, y: 12, rot: 0, name: "3.3 V regulator", does: "Steady supply for the logic", group: "Supply", label: true },
    { ref: "U5", footprint: SOT6, x: 14, y: 22, rot: 0, name: "USB protection", does: "Clamps ESD on the data lines", group: "Power in" },
    { ref: "U4", footprint: LGA8, x: 22, y: 32, rot: 0, name: "Climate sensor", does: "Temperature, humidity, pressure", group: "Sensor", label: true },
    { ref: "Y1", footprint: XTAL, x: 33, y: 30, rot: 0, name: "32 kHz crystal", does: "Keeps time in deep sleep", group: "Radio" },
    { ref: "SW1", footprint: BTN, x: 27, y: 35.5, rot: 0, name: "Boot button", group: "Controls" },
    { ref: "SW2", footprint: BTN, x: 34, y: 35.5, rot: 0, name: "Reset button", group: "Controls" },
    { ref: "D1", footprint: LED, x: 14, y: 30.5, rot: 0, name: "Status LED", group: "Controls" },
    { ref: "R4", footprint: R0402, x: 14, y: 27.5, rot: 0, name: "LED resistor", group: "Controls" },
    { ref: "C1", footprint: C0805, x: 17, y: 17, rot: 0, name: "Input capacitor", group: "Charger" },
    { ref: "R1", footprint: R0402, x: 21, y: 8.5, rot: 0, name: "Charge-rate resistor", group: "Charger" },
    { ref: "C2", footprint: C0805, x: 21, y: 14, rot: 90, name: "Battery capacitor", group: "Charger" },
    { ref: "C3", footprint: C0603, x: 24, y: 16.5, rot: 0, name: "Regulator input cap", group: "Supply" },
    { ref: "C4", footprint: C0603, x: 29.5, y: 15, rot: 90, name: "Regulator output cap", group: "Supply" },
    { ref: "C5", footprint: C0402, x: 34, y: 13, rot: 90, name: "Module decoupling", group: "Radio" },
    { ref: "R2", footprint: R0402, x: 34, y: 8.5, rot: 0, name: "Enable pull-up", group: "Radio" },
    { ref: "C6", footprint: C0402, x: 36.5, y: 6.5, rot: 0, name: "Enable delay", group: "Radio" },
    { ref: "C7", footprint: C0402, x: 25.5, y: 32, rot: 90, name: "Sensor decoupling", group: "Sensor" },
    { ref: "R3", footprint: R0402, x: 28, y: 28, rot: 90, name: "SDA pull-up", group: "Sensor" },
    { ref: "R5", footprint: R0402, x: 30, y: 28, rot: 90, name: "SCL pull-up", group: "Sensor" },
    { ref: "R6", footprint: R0402, x: 11.5, y: 15, rot: 0, name: "CC1 resistor", group: "Power in" },
    { ref: "R7", footprint: R0402, x: 11.5, y: 25, rot: 0, name: "CC2 resistor", group: "Power in" },
  ],
  nets: [
    { name: "VBUS", kind: "power", width: 0.5, pins: [["J1", "A4"], ["U5", "5"], ["C1", "1"], ["U2", "4"]] },
    { name: "VBAT", kind: "power", width: 0.5, pins: [["U2", "3"], ["C2", "1"], ["J2", "1"]] },
    { name: "VBAT_LDO", kind: "power", width: 0.5, pins: [["C2", "1"], ["U3", "1"], ["C3", "1"]] },
    { name: "EN_LDO", kind: "signal", width: 0.25, pins: [["U3", "1"], ["U3", "3"]] },
    { name: "3V3", kind: "power", width: 0.4, pins: [["U3", "5"], ["C4", "1"], ["C5", "1"], ["U1", "1"]] },
    { name: "3V3_B", kind: "power", width: 0.4, pins: [["C4", "2"], ["R3", "1"], ["R5", "1"]] },
    { name: "3V3_S", kind: "power", width: 0.3, pins: [["R3", "1"], ["C7", "1"], ["U4", "8"]] },
    { name: "EN", kind: "signal", width: 0.25, pins: [["R2", "2"], ["C6", "1"]] },
    { name: "EN_M", kind: "signal", width: 0.25, pins: [["R2", "2"], ["U1", "2"]] },
    { name: "PU", kind: "power", width: 0.3, pins: [["R2", "1"], ["C5", "1"]] },
    { name: "RST", kind: "signal", width: 0.25, pins: [["U1", "10"], ["SW2", "2"]] },
    { name: "BOOT", kind: "signal", width: 0.25, pins: [["U1", "8"], ["SW1", "2"]] },
    { name: "D+", kind: "usb", width: 0.3, pins: [["J1", "A6"], ["U5", "1"], ["U1", "14"]] },
    { name: "D-", kind: "usb", width: 0.3, pins: [["J1", "A7"], ["U5", "3"], ["U1", "13"]] },
    { name: "CC1", kind: "signal", width: 0.25, pins: [["J1", "A5"], ["R6", "2"]] },
    { name: "CC2", kind: "signal", width: 0.25, pins: [["J1", "B5"], ["R7", "2"]] },
    { name: "SDA", kind: "signal", width: 0.25, pins: [["U4", "3"], ["R3", "2"], ["U1", "3"]] },
    { name: "SCL", kind: "signal", width: 0.25, pins: [["U4", "4"], ["R5", "2"], ["U1", "4"]] },
    { name: "LED", kind: "signal", width: 0.25, pins: [["U1", "12"], ["R4", "2"]] },
    { name: "LED_K", kind: "signal", width: 0.25, pins: [["R4", "1"], ["D1", "1"]] },
    { name: "XIN", kind: "signal", width: 0.25, pins: [["U1", "18"], ["Y1", "1"]] },
    { name: "XOUT", kind: "signal", width: 0.25, pins: [["U1", "17"], ["Y1", "2"]] },
    { name: "PROG", kind: "signal", width: 0.25, pins: [["U2", "5"], ["R1", "1"]] },
    {
      name: "GND",
      kind: "ground",
      width: 0.4,
      pins: [
        ["J1", "A1"], ["U5", "2"], ["C1", "2"], ["U2", "2"], ["C2", "2"], ["U3", "2"], ["C3", "2"],
        ["C5", "2"], ["C6", "2"], ["U1", "9"], ["U4", "1"], ["U4", "7"], ["C7", "2"],
        ["R1", "2"], ["R6", "1"], ["R7", "1"], ["SW1", "1"], ["SW2", "1"], ["D1", "2"], ["J2", "2"], ["U4", "5"],
      ],
    },
  ],
};

/** Functional blocks for the brief / block diagram view. */
export const BLOCKS = [
  { id: "Power in", title: "USB-C input", note: "Power, data and ESD protection" },
  { id: "Charger", title: "Li-ion charger", note: "Charges the cell from USB" },
  { id: "Supply", title: "3.3 V supply", note: "Low-dropout regulator" },
  { id: "Radio", title: "ESP32-C3 module", note: "Wi-Fi + BLE, native USB" },
  { id: "Sensor", title: "Climate sensor", note: "I²C, address 0x76" },
  { id: "Controls", title: "Buttons and LED", note: "Boot, reset, status" },
];

/* ---------- boards inside the concept products ---------- */

export const AIR_BOARD: BoardSpec = {
  id: "air-board",
  title: "Air monitor main board",
  width: 70,
  height: 70,
  radius: 4,
  thickness: 1.6,
  finish: { mask: "black", silk: "white", surface: "enig" },
  holes: [
    { x: 5, y: 5, d: 2.7 },
    { x: 65, y: 5, d: 2.7 },
    { x: 5, y: 65, d: 2.7 },
    { x: 65, y: 65, d: 2.7 },
  ],
  parts: [
    { ref: "U1", footprint: ESP, x: 50, y: 35, rot: 90, name: "Wi-Fi module", group: "Radio" },
    { ref: "J1", footprint: USBC, x: 4.5, y: 35, rot: 90, name: "USB-C", group: "Power in" },
    { ref: "U4", footprint: LGA8, x: 20, y: 56, rot: 0, name: "Climate sensor", group: "Sensor" },
    { ref: "U2", footprint: SOT5, x: 18, y: 22, rot: 0, name: "Charger", group: "Charger" },
    { ref: "U3", footprint: SOT5, x: 28, y: 22, rot: 0, name: "Regulator", group: "Supply" },
    { ref: "U5", footprint: SOT6, x: 16, y: 40, rot: 0, name: "USB protection", group: "Power in" },
    { ref: "SW1", footprint: BTN, x: 30, y: 62, rot: 0, name: "Button", group: "Controls" },
    { ref: "D1", footprint: LED, x: 40, y: 62, rot: 0, name: "LED", group: "Controls" },
    { ref: "C1", footprint: C0805, x: 18, y: 28, rot: 0, name: "Cap", group: "Charger" },
    { ref: "C2", footprint: C0603, x: 28, y: 28, rot: 0, name: "Cap", group: "Supply" },
    { ref: "C3", footprint: C0402, x: 36, y: 24, rot: 90, name: "Cap", group: "Radio" },
    { ref: "R1", footprint: R0402, x: 24, y: 56, rot: 90, name: "Resistor", group: "Sensor" },
    { ref: "J2", footprint: JST, x: 34, y: 8, rot: 180, name: "Battery", group: "Power in" },
  ],
  nets: [
    { name: "VBUS", kind: "power", width: 0.5, pins: [["J1", "A4"], ["U5", "5"], ["C1", "1"], ["U2", "4"]] },
    { name: "VBAT", kind: "power", width: 0.5, pins: [["U2", "3"], ["J2", "1"], ["U3", "1"]] },
    { name: "3V3", kind: "power", width: 0.4, pins: [["U3", "5"], ["C2", "1"], ["C3", "1"], ["U1", "1"]] },
    { name: "3V3S", kind: "power", width: 0.3, pins: [["C2", "1"], ["U4", "8"], ["R1", "1"]] },
    { name: "D+", kind: "usb", width: 0.3, pins: [["J1", "A6"], ["U5", "1"], ["U1", "14"]] },
    { name: "D-", kind: "usb", width: 0.3, pins: [["J1", "A7"], ["U5", "3"], ["U1", "13"]] },
    { name: "SDA", kind: "signal", width: 0.25, pins: [["U4", "3"], ["U1", "3"]] },
    { name: "SCL", kind: "signal", width: 0.25, pins: [["U4", "4"], ["U1", "4"]] },
    { name: "BTN", kind: "signal", width: 0.25, pins: [["SW1", "2"], ["U1", "8"]] },
    { name: "LED", kind: "signal", width: 0.25, pins: [["D1", "1"], ["U1", "12"]] },
    { name: "GND", kind: "ground", width: 0.4, pins: [["J1", "A1"], ["U5", "2"], ["C1", "2"], ["U2", "2"], ["U3", "2"], ["C2", "2"], ["C3", "2"], ["U1", "9"], ["U4", "1"], ["SW1", "1"], ["D1", "2"], ["J2", "2"]] },
  ],
};

export const REMOTE_BOARD: BoardSpec = {
  id: "remote-board",
  title: "Remote board",
  width: 34,
  height: 52,
  radius: 6,
  thickness: 1.2,
  finish: { mask: "black", silk: "white", surface: "enig" },
  holes: [
    { x: 4.5, y: 47.5, d: 2.2 },
    { x: 29.5, y: 47.5, d: 2.2 },
  ],
  parts: [
    { ref: "U1", footprint: ESP, x: 17, y: 25, rot: 0, name: "BLE module", group: "Radio" },
    { ref: "SW1", footprint: BTN, x: 17, y: 41, rot: 0, name: "Main button", group: "Controls" },
    { ref: "D1", footprint: LED, x: 9, y: 41, rot: 90, name: "LED", group: "Controls" },
    { ref: "D2", footprint: LED, x: 25, y: 41, rot: 90, name: "LED", group: "Controls" },
    { ref: "D3", footprint: LED, x: 17, y: 47, rot: 0, name: "LED", group: "Controls" },
    { ref: "U3", footprint: SOT5, x: 10.5, y: 47, rot: 0, name: "Regulator", group: "Supply" },
    { ref: "C1", footprint: C0603, x: 26, y: 46.5, rot: 0, name: "Cap", group: "Supply" },
    { ref: "C2", footprint: C0402, x: 5, y: 36, rot: 90, name: "Cap", group: "Supply" },
  ],
  nets: [
    { name: "3V3", kind: "power", width: 0.4, pins: [["U3", "5"], ["C1", "1"], ["U1", "1"]] },
    { name: "BTN", kind: "signal", width: 0.25, pins: [["SW1", "2"], ["U1", "15"]] },
    { name: "L1", kind: "signal", width: 0.25, pins: [["D1", "1"], ["U1", "8"]] },
    { name: "L2", kind: "signal", width: 0.25, pins: [["D2", "2"], ["U1", "11"]] },
    { name: "GND", kind: "ground", width: 0.4, pins: [["U3", "2"], ["C1", "2"], ["C2", "2"], ["U1", "9"], ["SW1", "1"], ["D3", "2"]] },
  ],
};

export const TAG_BOARD: BoardSpec = {
  id: "tag-board",
  title: "Tag board",
  width: 34,
  height: 34,
  radius: 17,
  thickness: 1.0,
  finish: { mask: "black", silk: "white", surface: "enig" },
  holes: [],
  parts: [
    { ref: "U4", footprint: LGA8, x: 17, y: 9, rot: 0, name: "Motion sensor", group: "Sensor" },
    { ref: "U2", footprint: SOT6, x: 10, y: 16, rot: 0, name: "Buzzer driver", group: "Controls" },
    { ref: "Y1", footprint: XTAL, x: 24, y: 16, rot: 0, name: "Crystal", group: "Radio" },
    { ref: "SW1", footprint: BTN, x: 17, y: 25, rot: 0, name: "Button", group: "Controls" },
    { ref: "D1", footprint: LED, x: 8, y: 24, rot: 90, name: "LED", group: "Controls" },
    { ref: "C1", footprint: C0402, x: 21, y: 9, rot: 90, name: "Cap", group: "Sensor" },
    { ref: "C2", footprint: C0603, x: 26, y: 24, rot: 90, name: "Cap", group: "Supply" },
  ],
  nets: [
    { name: "SDA", kind: "signal", width: 0.25, pins: [["U4", "3"], ["U2", "6"]] },
    { name: "X", kind: "signal", width: 0.25, pins: [["Y1", "1"], ["C2", "1"]] },
    { name: "B", kind: "signal", width: 0.25, pins: [["SW1", "2"], ["U2", "4"]] },
    { name: "GND", kind: "ground", width: 0.3, pins: [["U4", "1"], ["C1", "2"], ["U2", "2"], ["D1", "2"], ["SW1", "1"]] },
  ],
};
