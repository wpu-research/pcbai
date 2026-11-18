import { createProject } from "@/app/actions/projects";
import { NewProjectForm } from "@/components/app/NewProjectForm";
import { PageHead } from "@/components/app/Shell";
import { appT } from "@/lib/lang-server";

export default async function NewProject() {
  const { a } = await appT();
  return (
    <>
      <PageHead title={a.panel.newTitle} lede={a.panel.newLede} />
      <NewProjectForm action={createProject} />
    </>
  );
}
