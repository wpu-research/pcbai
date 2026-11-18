"use client";

import { useEffect, useRef } from "react";

/** A trace down the left edge of the page; a lit signal travels it as you scroll. */
export function Rail() {
  const dot = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - innerHeight;
        const p = max > 0 ? scrollY / max : 0;
        const h = innerHeight - 140;
        if (dot.current) dot.current.style.transform = `translateY(${(p * h).toFixed(1)}px)`;
        if (fill.current) fill.current.style.height = `${(p * h).toFixed(1)}px`;
      });
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed bottom-10 left-[max(12px,calc((100vw-1200px)/2-36px))] top-[100px] z-[3] hidden w-6 xl:block">
      <div className="absolute left-[11px] top-0 h-full w-px bg-line-2" />
      <div className="absolute left-[14px] top-0 h-full w-px bg-line-1" />
      <div ref={fill} className="absolute left-[11px] top-0 w-px bg-gradient-to-b from-teal-300/0 via-teal-300 to-pink-300" />
      <div ref={dot} className="absolute left-0 top-0 grid h-6 w-6 place-items-center will-change-transform">
        <span className="absolute h-6 w-6 rounded-full bg-[var(--glow-teal)] blur-md" />
        <svg viewBox="0 0 24 24" className="relative h-6 w-6">
          <rect x="5" y="6" width="14" height="12" rx="3" fill="#17171a" stroke="#7ed0dd" strokeWidth="1.2" />
          <circle cx="9.5" cy="12" r="1.4" fill="#7ed0dd" />
          <circle cx="14.5" cy="12" r="1.4" fill="#f2c2cf" />
          <path d="M12 6V3.5M5 12H3M19 12h2" stroke="#8a8984" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
