import Link from "next/link";
import type { ReactNode } from "react";
import { LangSwitch } from "@/lib/i18n";
import AuthBoard from "./AuthBoard";
import { Logo } from "../site/Logo";

export function AuthLayout({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-display text-[17px] font-semibold tracking-tight">
              pcb<span className="text-teal-300">·</span>ai
            </span>
          </Link>
          <LangSwitch />
        </div>
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          <h1 className="h-display text-[40px]">{title}</h1>
          <p className="mb-8 mt-3 text-[15px] text-t-2">{lede}</p>
          {children}
        </div>
      </div>
      <div className="relative hidden border-l border-line-1 lg:block">
        <AuthBoard />
      </div>
    </div>
  );
}
