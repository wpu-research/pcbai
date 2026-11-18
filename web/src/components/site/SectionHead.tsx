import type { ReactNode } from "react";

/** Numbered section opener: folio "02 _", headline left, lede right. */
export function SectionHead({ n, id, title, children }: { n: string; id: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
      <div>
        <div className="folio">{n}</div>
        <h2 id={id} className="h-section mt-3 text-t-1">
          {title}
        </h2>
      </div>
      {children && <div className="max-w-[30rem] text-copy text-t-2 lg:justify-self-end lg:pb-1">{children}</div>}
    </div>
  );
}

/** Light word inside a headline. */
export const L = ({ children }: { children: ReactNode }) => <span className="emph">{children}</span>;
