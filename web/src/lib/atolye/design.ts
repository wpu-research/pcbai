import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { LAB_CATALOG } from "../lab/catalog";
import { LAB_PINS } from "../lab/pins";

const PART_TYPES = Object.keys(LAB_PINS) as [string, ...string[]];

/** What the assistant returns: a circuit the lab can simulate, the sketch, and how to try it. */
export const Design = z.object({
  title: z.string().describe("Short project name"),
  summary: z.string().describe("Two or three sentences: what it does and how"),
  parts: z
    .array(
      z.object({
        id: z.string().describe("Unique id, lowercase, e.g. uno, led1, r1"),
        type: z.enum(PART_TYPES),
        label: z.string().describe("What this part does in the project, a few words"),
        props: z.array(z.object({ key: z.string(), value: z.string() })).describe("Only non-default settings, e.g. resistor ohms, led color"),
      }),
    )
    .describe("Exactly one part of type uno, plus everything it connects to"),
  wires: z.array(z.object({ from: z.object({ part: z.string(), pin: z.string() }), to: z.object({ part: z.string(), pin: z.string() }) })),
  code: z.string().describe("Complete Arduino sketch for the Uno, compilable with arduino:avr and the listed libraries"),
  steps: z.array(z.string()).describe("How to try it in the lab: what to press, turn or watch"),
});
export type DesignT = z.infer<typeof Design>;

const SYSTEM = `You design Arduino prototypes for the MacademiaX virtual lab, a browser simulator, for students and makers.
Given a project idea you return a complete circuit and a working sketch. Later turns refine the same project; return the whole updated design each time.

The circuit must use only these part types, with exactly these pin names (one line per type):
${LAB_CATALOG}

Wiring rules the simulator enforces:
- Exactly one "uno". Every other part connects to it. Ground every part (Uno GND, GND2 and GND3 are the same node).
- An LED always has a series resistor (220-1000 ohm) between the Uno pin and the anode; the cathode goes to ground.
- I2C parts use A4 for SDA and A5 for SCL; several I2C parts may share them.
- Power 5 V modules from 5V, 3.3 V-only parts from 3V3. Motors go through a driver (l293d, l298n, tb6612, drv8833) or a transistor/MOSFET with a flyback diode, never straight from a pin.
- D0 and D1 are the serial port; avoid them. Prefer D2-D13 for digital, A0-A3 for analog inputs, PWM on D3, D5, D6, D9, D10, D11.
- Wires connect one pin to one pin; to join several pins, chain them through a shared pin.

The sketch compiles with arduino-cli for arduino:avr:uno and only these libraries: Servo, LiquidCrystal, LiquidCrystal_I2C, DHT sensor library,
Adafruit Unified Sensor, Adafruit BusIO, Adafruit BMP280, Adafruit BME280, Adafruit GFX, Adafruit SSD1306, RTClib, Keypad, NewPing, MFRC522, IRremote, SD,
VL53L0X, OneWire, DallasTemperature, plus Wire and SPI. Use pin numbers that match the wiring, print useful values to Serial at 9600 baud, and comment the code briefly in the user's language.

Keep the design as simple as the idea allows. Write title, summary, labels, steps and code comments in the user's language.`;

export class DesignError extends Error {}

/** Problems the simulator would reject: unknown parts, wrong pin names, a missing Uno. */
export function checkDesign(d: DesignT): string[] {
  const errs: string[] = [];
  const parts = new Map(d.parts.map((p) => [p.id, p]));
  if (parts.size !== d.parts.length) errs.push("Part ids must be unique.");
  if (d.parts.filter((p) => p.type === "uno").length !== 1) errs.push("There must be exactly one part of type uno.");
  for (const w of d.wires)
    for (const e of [w.from, w.to]) {
      const p = parts.get(e.part);
      if (!p) errs.push(`Wire refers to unknown part "${e.part}".`);
      else if (!LAB_PINS[p.type]?.includes(e.pin)) errs.push(`Part "${e.part}" (${p.type}) has no pin "${e.pin}"; valid pins: ${LAB_PINS[p.type].join(", ")}.`);
    }
  return errs;
}

let client: Anthropic | null = null;
// keys that aren't scoped to a workspace need the workspace named on every request
const api = () =>
  (client ??= new Anthropic(process.env.ANTHROPIC_WORKSPACE_ID ? { defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } } : {}));

export const designConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export async function designProject(history: Anthropic.Beta.BetaMessageParam[]): Promise<DesignT> {
  const ask = (messages: Anthropic.Beta.BetaMessageParam[]) =>
    api().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(Design) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });

  let res = await ask(history);
  if (res.stop_reason === "refusal") throw new DesignError("refused");
  if (res.stop_reason === "max_tokens" || !res.parsed_output) throw new DesignError("incomplete");
  let design = res.parsed_output;

  // one repair round when the simulator would reject a pin or part
  const errs = checkDesign(design);
  if (errs.length) {
    res = await ask([
      ...history,
      { role: "assistant", content: JSON.stringify(design) },
      { role: "user", content: `The lab rejects this design:\n- ${errs.join("\n- ")}\nReturn the corrected full design.` },
    ]);
    if (res.stop_reason === "refusal") throw new DesignError("refused");
    if (!res.parsed_output) throw new DesignError("incomplete");
    design = res.parsed_output;
    if (checkDesign(design).length) throw new DesignError("invalid");
  }
  return design;
}
