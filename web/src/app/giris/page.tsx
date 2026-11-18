import { redirect } from "next/navigation";
import { AuthForm } from "@/components/app/AuthForm";
import { AuthLayout } from "@/components/app/AuthLayout";
import { currentUser } from "@/lib/auth";
import { appT } from "@/lib/lang-server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await currentUser();
  if (u) redirect(u.role === "admin" ? "/admin" : "/panel");
  const { a } = await appT();
  const { next } = await searchParams;
  return (
    <AuthLayout title={a.auth.loginTitle} lede={a.auth.loginLede}>
      <AuthForm mode="login" next={next} />
    </AuthLayout>
  );
}
