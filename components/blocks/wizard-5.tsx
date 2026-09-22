"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,transform] duration-150 ease-out";

const frame =
  "flex flex-col gap-1 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900";

const panel =
  "rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-950";

const STEPS = ["Details", "Schedule", "Recipients", "Review"];

const GROUPS = [
  {
    id: "details",
    title: "Campaign details",
    rows: [
      { label: "Name", value: "Spring product update" },
      { label: "Sender", value: "Kepler Works <news@kepler.works>" },
      { label: "Reply-to", value: "support@kepler.works" },
    ],
  },
  {
    id: "schedule",
    title: "Schedule",
    rows: [
      { label: "Send at", value: "24 April 2026, 09:00" },
      { label: "Timezone", value: "Europe/Lisbon" },
      { label: "Throttle", value: "5,000 per hour" },
    ],
  },
  {
    id: "recipients",
    title: "Recipients",
    rows: [
      { label: "Audience", value: "Product subscribers" },
      { label: "Size", value: "18,204 contacts" },
      { label: "Suppressed", value: "412 unsubscribed" },
    ],
  },
];

export default function Wizard5() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="relative h-full min-h-[720px] w-full overflow-y-auto bg-white p-6 sm:p-8 dark:bg-neutral-950">
      <section className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-[var(--rb-r-2xl,14px)] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <ol className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          {STEPS.map((label, i) => {
            const done = i < STEPS.length - 1;
            const active = i === STEPS.length - 1;

            return (
              <li
                key={label}
                className={cx(
                  "flex min-w-0 items-center gap-3",
                  i < STEPS.length - 1 && "flex-1",
                )}
              >
                <span
                  aria-current={active ? "step" : undefined}
                  className="flex min-w-0 items-center gap-2.5"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                      done
                        ? "bg-[var(--rb-accent,oklch(20.5%_0_0))] text-[var(--rb-accent-fg,oklch(100%_0_0))] dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))]"
                        : "border border-dashed border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-100",
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="hidden truncate text-[13px] font-medium text-neutral-900 sm:block dark:text-neutral-100">
                    {label}
                  </span>
                </span>

                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="h-px min-w-4 flex-1 bg-[var(--rb-accent,oklch(20.5%_0_0))] dark:bg-[var(--rb-accent,oklch(100%_0_0))]"
                  />
                )}
              </li>
            );
          })}
        </ol>

        <div className="min-h-0 flex-1 px-6 py-5">
          <h2 className="text-base font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
            Review before sending
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
            Nothing sends until you confirm. Each section can still be changed.
          </p>

          <div className="mt-5 space-y-3">
            {GROUPS.map((group) => (
              <div key={group.id} className={frame}>
                <div
                  className={cx(
                    panel,
                    "flex items-center justify-between gap-3 px-4 py-2.5",
                  )}
                >
                  <h3 className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                    {group.title}
                  </h3>
                  <button
                    type="button"
                    className={cx(
                      "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--rb-r-sm,6px)] bg-neutral-100 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200 active:scale-[0.97] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
                      transition,
                      focus,
                    )}
                  >
                    <Pencil aria-hidden="true" className="h-3 w-3" />
                    Edit
                    <span className="sr-only"> {group.title}</span>
                  </button>
                </div>

                <dl className={cx(panel, "px-4 py-1")}>
                  {group.rows.map((row, i) => (
                    <div
                      key={row.label}
                      className={cx(
                        "flex items-center justify-between gap-4 py-2.5",
                        i > 0 &&
                          "border-t border-neutral-200/70 dark:border-neutral-800",
                      )}
                    >
                      <dt className="shrink-0 text-[13px] text-neutral-500">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 truncate text-right text-[13px] text-neutral-900 dark:text-neutral-100">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[var(--rb-r-lg,10px)] border border-neutral-200 p-4 dark:border-neutral-800">
            <button
              type="button"
              role="checkbox"
              aria-checked={confirmed}
              onClick={() => setConfirmed((v) => !v)}
              className={cx(
                "mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[var(--rb-r-xs,4px)] border active:scale-[0.97]",
                confirmed
                  ? "border-neutral-900 bg-[var(--rb-accent,oklch(20.5%_0_0))] text-[var(--rb-accent-fg,oklch(100%_0_0))] dark:border-white dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))]"
                  : "border-neutral-300 text-transparent hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600",
                transition,
                focus,
              )}
            >
              <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
            </button>
            <span className="min-w-0 text-[13px] text-neutral-600 dark:text-neutral-400">
              I have checked the audience and schedule. Sending to 18,204
              contacts cannot be undone once delivery starts.
            </span>
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            className={cx(
              "inline-flex h-9 cursor-pointer items-center justify-center rounded-[var(--rb-r-md,8px)] bg-neutral-100 px-3 text-[13px] font-medium text-neutral-700 hover:bg-neutral-200 active:scale-[0.97] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
              transition,
              focus,
            )}
          >
            Back
          </button>

          <button
            type="button"
            disabled={!confirmed}
            className={cx(
              "inline-flex h-9 cursor-pointer items-center justify-center rounded-[var(--rb-r-md,8px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] px-4 text-[13px] font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(20.5%_0_0))_90%,transparent)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))] dark:hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(100%_0_0))_90%,transparent)]",
              transition,
              focus,
            )}
          >
            Schedule send
          </button>
        </div>
      </section>
    </div>
  );
}
