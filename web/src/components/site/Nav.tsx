"use client";

import { BRAND } from "@/lib/brand";
import { LangSwitch, useT } from "@/lib/i18n";
import { Logo } from "./Logo";

export function Nav() {
  const t = useT();
  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-g-1/95 to-g-1/70 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
          <Logo className="h-7 w-7" />
          <span className="font-display text-[17px] font-semibold tracking-tight">
            pcb<span className="text-teal-300">·</span>ai
          </span>
        </a>
        <nav className="ml-10 hidden gap-7 text-[14px] text-t-2 lg:flex">
          <a href="#how" className="hover:text-t-1">{t.nav.how}</a>
          <a href="#factory" className="hover:text-t-1">{t.nav.factory}</a>
          <a href="#products" className="hover:text-t-1">{t.nav.boards}</a>
          <a href="#pricing" className="hover:text-t-1">{t.nav.pricing}</a>
          <a href="/sunum.html" className="hover:text-t-1">{t.nav.deck}</a>
        </nav>
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <LangSwitch />
          <a href="/giris" className="hidden text-[14px] text-t-2 hover:text-t-1 sm:block">{t.nav.signIn}</a>
          <a href="/kayit" className="btn btn-ghost hidden h-8 text-[13px] sm:inline-flex">{t.nav.start}</a>
        </div>
      </div>
    </header>
  );
}
