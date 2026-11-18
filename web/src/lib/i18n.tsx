"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DICT, type Dict, type Lang } from "./dict";

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({ lang: "en", t: DICT.en, setLang: () => {} });

const COOKIE = "pcbai_lang";

function remember(l: Lang) {
  document.cookie = `${COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
}

/** `initial` comes from the server (cookie or Accept-Language); `force` pins a language (the deck). */
export function LangProvider({ children, force, initial }: { children: ReactNode; force?: Lang; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(force ?? initial ?? "en");
  useEffect(() => {
    if (force) return;
    const q = new URLSearchParams(location.search).get("lang");
    if ((q === "tr" || q === "en") && q !== lang) {
      setLangState(q);
      remember(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [force]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    remember(l);
    // server-rendered pages (panel, admin, auth) need a fresh render in the new language
    if (/^\/(panel|admin|giris|kayit|aktar)/.test(location.pathname)) location.reload();
  };
  return <Ctx.Provider value={{ lang, t: DICT[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div role="group" aria-label="Language" className="flex h-8 items-center rounded-md border border-line-2 p-0.5 font-mono text-[11px]">
      {(["en", "tr"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`h-full rounded-[3px] px-2 uppercase tracking-wider transition-colors ${lang === l ? "bg-g-4 text-t-1" : "text-t-3 hover:text-t-2"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
