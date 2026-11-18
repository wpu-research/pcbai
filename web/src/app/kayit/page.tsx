import { redirect } from "next/navigation";
import { AuthForm } from "@/components/app/AuthForm";
import { AuthLayout } from "@/components/app/AuthLayout";
import { currentUser } from "@/lib/auth";
import { appT } from "@/lib/lang-server";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/panel");
  const { a } = await appT();
  return (
    <AuthLayout title={a.auth.registerTitle} lede={a.auth.registerLede}>
      <AuthForm mode="register" />
    </AuthLayout>
  );
}
