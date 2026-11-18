import { PageHead } from "@/components/app/Shell";
import { PasswordForm } from "@/components/app/PasswordForm";
import { requireUser } from "@/lib/auth";
import { appT } from "@/lib/lang-server";

export default async function Account() {
  const user = await requireUser();
  const { a } = await appT();
  return (
    <>
      <PageHead title={a.nav.account} lede={`${user.name} · ${user.email}`} />
      <PasswordForm />
    </>
  );
}
