import { count, desc, eq } from "drizzle-orm";
import { setRole } from "@/app/actions/admin";
import { PageHead, Pill } from "@/components/app/Shell";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { appT } from "@/lib/lang-server";

export default async function AdminMembers() {
  const me = await requireAdmin();
  const { a, lang } = await appT();
  const d = await db();
  const rows = await d
    .select({ u: schema.users, projects: count(schema.projects.id) })
    .from(schema.users)
    .leftJoin(schema.projects, eq(schema.projects.userId, schema.users.id))
    .groupBy(schema.users.id)
    .orderBy(desc(schema.users.createdAt));
  return (
    <>
      <PageHead title={a.nav.members} />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead>
            <tr className="fig border-b border-line-2 text-left">
              {[a.admin.member, a.auth.email, a.admin.role, a.admin.stats.projects, a.admin.joined, a.admin.lastLogin, ""].map((h, i) => (
                <th key={i} className="px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ u, projects }) => (
              <tr key={u.id} className="border-b border-line-1 last:border-0">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 font-mono text-[12.5px] text-t-2">{u.email}</td>
                <td className="px-4 py-3"><Pill tone={u.role === "admin" ? "pink" : "muted"}>{u.role}</Pill></td>
                <td className="px-4 py-3 font-mono">{projects}</td>
                <td className="px-4 py-3 text-t-3">{fmtDate(u.createdAt, lang)}</td>
                <td className="px-4 py-3 text-t-3">{fmtDate(u.lastLoginAt, lang, true)}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== me.id && (
                    <form action={setRole.bind(null, u.id, u.role === "admin" ? "member" : "admin")}>
                      <button className="text-[12.5px] text-t-3 hover:text-t-1">{u.role === "admin" ? a.admin.makeMember : a.admin.makeAdmin}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
