import Anthropic from "@anthropic-ai/sdk";
import { currentUser, rateLimited } from "@/lib/auth";
import { designConfigured, designProject, DesignError } from "@/lib/atolye/design";
import { designToLab } from "@/lib/atolye/to-lab";

export const maxDuration = 300;

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!designConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  if (rateLimited(`atolye|${user.id}`, 30, 60 * 60_000)) return Response.json({ error: "limited" }, { status: 429 });

  let turns: Turn[];
  try {
    const body = (await req.json()) as { messages?: Turn[] };
    turns = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12);
  } catch {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  if (!turns.length || turns[turns.length - 1].role !== "user") return Response.json({ error: "bad-request" }, { status: 400 });
  if (turns.some((t) => t.content.length > 40_000) || turns[turns.length - 1].content.length > 4000) return Response.json({ error: "too-long" }, { status: 413 });

  try {
    const design = await designProject(turns.map((t) => ({ role: t.role, content: t.content })));
    return Response.json({ design, lab: designToLab(design) });
  } catch (e) {
    if (e instanceof DesignError) return Response.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 503 });
    if (e instanceof Anthropic.APIError) {
      console.error("[atolye] API error", e.status, e.message);
      return Response.json({ error: "upstream" }, { status: 502 });
    }
    console.error("[atolye]", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
