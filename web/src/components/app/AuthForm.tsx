"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type AuthState } from "@/app/actions/auth";
import { APP } from "@/lib/dict-app";
import { useI18n } from "@/lib/i18n";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const { lang } = useI18n();
  const a = APP[lang].auth;
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, {});
  const field = "mt-1.5 h-11 w-full rounded-md border border-line-3 bg-g-1 px-3 text-[14.5px] text-t-1 outline-none focus:border-teal-400 focus:shadow-[0_0_0_4px_#5bbfcd1f]";
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "register" && (
        <label className="block text-[13px] text-t-2">
          {a.name}
          <input name="name" defaultValue={state.name} autoComplete="name" required className={field} />
        </label>
      )}
      <label className="block text-[13px] text-t-2">
        {a.email}
        <input name="email" type="email" defaultValue={state.email} autoComplete="email" required className={field} />
      </label>
      <label className="block text-[13px] text-t-2">
        {a.password}
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} className={field} />
        {mode === "register" && <span className="mt-1 block text-[12px] text-t-3">{a.passwordHint}</span>}
      </label>
      {state.error && (
        <p role="alert" className="rounded-md border border-[#f08a7e55] bg-[#f08a7e14] px-3 py-2 text-[13px] text-crit">
          {a.errors[state.error] ?? state.error}
        </p>
      )}
      <button disabled={pending} className="btn btn-primary h-11 w-full justify-center text-[14.5px] disabled:opacity-60">
        {pending ? "…" : mode === "login" ? a.login : a.register}
      </button>
      <p className="text-center text-[13px] text-t-3">
        {mode === "login" ? a.noAccount : a.haveAccount}{" "}
        <Link href={mode === "login" ? "/kayit" : "/giris"} className="text-teal-300 hover:text-teal-200">
          {mode === "login" ? a.toRegister : a.toLogin}
        </Link>
      </p>
    </form>
  );
}
