import { ownedProject } from "@/app/actions/projects";
import { zipResponse } from "@/lib/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const owned = await ownedProject((await params).id);
  if (!owned?.project.spec) return new Response("Not found", { status: 404 });
  return zipResponse(owned.project.spec, owned.project.title, owned.project.version, owned.project.sketch);
}
