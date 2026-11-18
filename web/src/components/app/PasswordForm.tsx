"use client";

import { useActionState } from "react";
import { changePassword, type PwState } from "@/app/actions/auth";
import { APP } from "@/lib/dict-app";
import { useI18n } from "@/lib/i18n";

export function PasswordForm() {
  const { lang } = useI18n();
  const a = APP[lang];
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, {});
  const f = "mt-1.5 h-10 w-full rounded-md border border-line-3 bg-g-1 px-3 text-[14px] text-t-1 outline-none focus:border-teal-400";
  return (
    <form action={action} className="card max-w-[420px] space-y-4 p-5">
      <div className="eyebrow">{a.panel.changePw}</div>
      <label className="block text-[13px] text-t-2">
        {a.panel.currentPw}
        <input name="current" type="password" autoComplete="current-password" required className={f} />
      </label>
      <label className="block text-[13px] text-t-2">
        {a.panel.newPw}
        <input name="next" type="password" autoComplete="new-password" minLength={8} required className={f} />
        <span className="mt-1 block text-[12px] text-t-3">{a.auth.passwordHint}</span>
      </label>
      {state.error && <p className="text-[13px] text-crit">{state.error === "invalid" ? a.panel.wrongPw : a.auth.errors[state.error]}</p>}
      {state.ok && <p className="text-[13px] text-ok">✓ {a.panel.pwChanged}</p>}
      <button disabled={pending} className="btn btn-primary disabled:opacity-60">{a.panel.save}</button>
    </form>
  );
}
