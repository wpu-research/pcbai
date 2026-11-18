import type { OrderEvent, OrderStatus } from "@/db/schema";
import type { Lang } from "@/lib/dict";
import { fmtDate, ORDER_STEPS } from "@/lib/format";

/** Vertical progress: every step, the ones reached lit, with the notes left on the way. */
export function OrderTimeline({ status, events, labels, lang }: { status: OrderStatus; events: OrderEvent[]; labels: Record<OrderStatus, string>; lang: Lang }) {
  const at = ORDER_STEPS.indexOf(status);
  const cancelled = status === "cancelled";
  const steps = cancelled ? ([...new Set(events.map((e) => e.status))] as OrderStatus[]) : ORDER_STEPS;
  return (
    <ol className="relative space-y-3 pl-5">
      <span className="absolute bottom-1.5 left-[4px] top-1.5 w-px bg-line-2" />
      {steps.map((s, i) => {
        const reached = cancelled ? true : i <= at;
        const evs = events.filter((e) => e.status === s);
        const last = evs[evs.length - 1];
        return (
          <li key={s} className="relative">
            <span
              className={`absolute -left-5 top-1 h-[9px] w-[9px] rounded-full border-2 ${
                s === "cancelled" ? "border-crit bg-crit" : reached ? (i === at ? "border-teal-300 bg-teal-300 shadow-[0_0_10px_var(--teal-400)]" : "border-teal-300 bg-teal-300/60") : "border-line-3 bg-g-2"
              }`}
            />
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-[13px] ${reached ? "text-t-1" : "text-t-3"}`}>{labels[s]}</span>
              {last && <span className="fig shrink-0">{fmtDate(last.createdAt, lang, true)}</span>}
            </div>
            {evs.filter((e) => e.note).map((e) => (
              <p key={e.id} className="mt-1 text-[12.5px] leading-5 text-t-2">
                {e.note}
              </p>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
