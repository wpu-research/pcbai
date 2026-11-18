"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, exact }: { href: string; label: string; exact?: boolean }) {
  const path = usePathname();
  const on = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[13.5px] transition-colors ${on ? "bg-g-3 text-t-1" : "text-t-2 hover:bg-[var(--wash-hover)] hover:text-t-1"}`}
    >
      <span className={`h-[5px] w-[5px] rounded-full ${on ? "bg-teal-300" : "bg-t-4"}`} />
      {label}
    </Link>
  );
}
