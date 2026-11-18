import { ownedProject } from "@/app/actions/projects";
import { drawingResponse } from "@/lib/files";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owned = await ownedProject((await params).id);
  if (!owned?.project.spec) return new Response("Not found", { status: 404 });
  return drawingResponse(owned.project.spec, owned.project.title, new URL(req.url).searchParams.has("download"));
}
