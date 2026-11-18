import { Shell } from "@/components/app/Shell";
import { requireUser } from "@/lib/auth";
import { appT } from "@/lib/lang-server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { a } = await appT();
  return (
    <Shell
      user={user}
      area="panel"
      logoutLabel={a.auth.logout}
      items={[
        { href: "/panel/atolye", label: a.nav.workshop },
        { href: "/panel", label: a.nav.projects, exact: true },
        { href: "/panel/siparisler", label: a.nav.orders },
        { href: "/panel/yeni", label: a.nav.newProject },
        { href: "/panel/hesap", label: a.nav.account },
      ]}
      footer={[...(user.role === "admin" ? [{ href: "/admin", label: a.nav.admin }] : []), { href: "/", label: a.nav.site, exact: true }]}
    >
      {children}
    </Shell>
  );
}
