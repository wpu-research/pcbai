/** Mark: a chip outline with one routed trace leaving it, teal to pink. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg-trace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ed0dd" />
          <stop offset="1" stopColor="#f2c2cf" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="27" height="27" rx="6" fill="#111113" stroke="#ffffff29" />
      <rect x="7" y="7" width="9" height="9" rx="1.5" fill="none" stroke="#f2f1ee" strokeWidth="1.4" />
      <path d="M16 11.5h3.5l3 3V21" fill="none" stroke="url(#lg-trace)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="22.5" cy="21.5" r="1.7" fill="#d6b46c" />
      <path d="M9.5 16v3M13.5 16v3M7 9.5H4M7 13.5H4" stroke="#8a8984" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
