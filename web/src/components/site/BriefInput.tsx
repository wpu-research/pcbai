"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

/** Brief field whose placeholder types out example devices. */
export function BriefInput({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const EXAMPLES = t.brief.placeholder;
  const [value, setValue] = useState("");
  const [ph, setPh] = useState("");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPh(EXAMPLES[0]);
      return;
    }
    let i = 0, j = 0, dir = 1, wait = 0;
    const id = setInterval(() => {
      if (wait > 0) return void wait--;
      const s = EXAMPLES[i];
      j += dir;
      setPh(s.slice(0, j));
      if (j >= s.length) {
        dir = -1;
        wait = 40;
      } else if (j <= 0) {
        dir = 1;
        i = (i + 1) % EXAMPLES.length;
        wait = 6;
      }
    }, 45);
    return () => clearInterval(id);
  }, [EXAMPLES]);
  return (
    <form
      className={`flex max-w-[36rem] gap-3 ${compact ? "" : "flex-col sm:flex-row"}`}
      onSubmit={(e) => {
        e.preventDefault();
        location.href = "/kayit";
      }}
    >
      <label className="group flex h-12 flex-1 items-center gap-3 rounded-md border border-line-3 bg-g-1/80 px-4 backdrop-blur focus-within:border-teal-400 focus-within:shadow-[0_0_0_4px_#5bbfcd1f]">
        <span className="font-mono text-[13px] text-teal-300">›</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ph}
          aria-label={t.brief.aria}
          className="h-full flex-1 bg-transparent text-[14.5px] text-t-1 outline-none placeholder:text-t-3"
        />
        <span className="kbd">↵</span>
      </label>
      <button type="submit" className="btn btn-primary h-12 justify-center px-5 text-[14.5px]">
        {t.brief.go}
      </button>
    </form>
  );
}
