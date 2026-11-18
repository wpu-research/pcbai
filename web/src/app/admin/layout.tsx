import { Shell } from "@/components/app/Shell";
import { requireAdmin } from "@/lib/auth";
import { appT } from "@/lib/lang-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const { a } = await appT();
  return (
    <Shell
      user={user}
      area="admin"
      logoutLabel={a.auth.logout}
      items={[
        { href: "/admin", label: a.nav.overview, exact: true },
        { href: "/admin/siparisler", label: a.nav.allOrders },
        { href: "/admin/projeler", label: a.nav.allProjects },
        { href: "/admin/uyeler", label: a.nav.members },
        { href: "/admin/firmalar", label: a.nav.partners },
      ]}
      footer={[
        { href: "/panel", label: a.nav.projects, exact: true },
        { href: "/panel/hesap", label: a.nav.account },
        { href: "/", label: a.nav.site, exact: true },
      ]}
    >
      {children}
    </Shell>
  );
}
