import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import type { User } from "@/db/schema";
import { LangSwitch } from "@/lib/i18n";
import { Logo } from "../site/Logo";
import { NavLink } from "./NavLink";

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

/** Sidebar layout shared by the member panel and the admin. */
export function Shell({ user, items, footer, area, children, logoutLabel }: { user: Pick<User, "name" | "email" | "role">; items: NavItem[]; footer?: NavItem[]; area: string; children: ReactNode; logoutLabel: string }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-20 flex flex-col border-b border-line-1 bg-g-1/95 backdrop-blur lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-display text-[17px] font-semibold tracking-tight">
              pcb<span className="text-teal-300">·</span>ai
            </span>
          </Link>
          <span className="fig ml-1 rounded-[3px] border border-line-2 px-1.5 py-0.5 !text-[10px] uppercase tracking-[0.12em]">{area}</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0 lg:pt-2">
          {items.map((i) => (
            <NavLink key={i.href} {...i} />
          ))}
          {footer && <div className="hidden flex-1 lg:block" />}
          {footer?.map((i) => (
            <NavLink key={i.href} {...i} />
          ))}
        </nav>
        <div className="hidden border-t border-line-1 p-4 lg:block">
          <div className="truncate text-[13.5px] text-t-1">{user.name}</div>
          <div className="truncate font-mono text-[11px] text-t-3">{user.email}</div>
          <div className="mt-3 flex items-center justify-between">
            <LangSwitch />
            <form action={logout}>
              <button className="text-[12.5px] text-t-3 hover:text-t-1">{logoutLabel}</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 pb-20 pt-8 sm:px-8 lg:pt-10">{children}</main>
    </div>
  );
}

export function PageHead({ title, lede, children }: { title: ReactNode; lede?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">{title}</h1>
        {lede && <p className="mt-1.5 max-w-[46rem] text-[14px] text-t-2">{lede}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "muted" | "teal" | "pink" | "ok" | "warn" | "crit"; children: ReactNode }) {
  const tones = {
    muted: "border-line-2 text-t-2",
    teal: "border-teal-line bg-teal-tint text-teal-200",
    pink: "border-[var(--pink-line)] bg-pink-tint text-pink-300",
    ok: "border-[#88ce9755] bg-[#88ce9714] text-ok",
    warn: "border-[#e9cc7155] bg-[#e9cc7114] text-warn",
    crit: "border-[#f08a7e55] bg-[#f08a7e14] text-crit",
  };
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-1.5 py-0.5 font-mono text-[10.5px] ${tones[tone]}`}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-[30px] font-semibold leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-[12px] text-t-3">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line-2 px-6 py-12 text-center text-[14px] text-t-3">{children}</div>;
}
