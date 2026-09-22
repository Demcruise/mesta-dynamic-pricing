"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setEdges({
      start: scrollTop > 1,
      end: Math.ceil(scrollTop + clientHeight) < scrollHeight - 1,
    });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    const view = el?.ownerDocument.defaultView;
    if (!el || !view?.ResizeObserver) return;
    const observer = new view.ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  return { ref, edges, onScroll: update };
}

const CHANGES = [
  { label: "Retention window", from: "180 days", to: "45 days" },
  { label: "Nightly purge", from: "Off", to: "On" },
  { label: "Grace period before purge", from: "None", to: "7 days" },
];

const RAW_PATCH = `retention:
- invoiceDraftDays: 180
+ invoiceDraftDays: 45
+ nightlyPurge: true
+ purgeGraceDays: 7
  keepPostedInvoices: true`;

type Decision = "pending" | "once" | "always" | "denied";

const focusRing =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";
const press =
  "transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]";

export default function AgentApproval2() {
  const reduceMotion = useReducedMotion();
  const [decision, setDecision] = useState<Decision>("pending");
  const [showPatch, setShowPatch] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const body = useScrollFade<HTMLElement>();

  useEffect(() => {
    if (!announcement) return;
    const id = setTimeout(() => setAnnouncement(""), 2400);
    return () => clearTimeout(id);
  }, [announcement]);

  const enter = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] as const },
      };

  const settledLine =
    decision === "denied"
      ? "Skipped, not approved"
      : decision === "always"
        ? "Always allowed: policy edits in this project now run automatically"
        : "Allowed once, the retention policy was updated";

  return (
    <div className="flex h-full min-h-[560px] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 sm:px-6">
        <h2 className="text-base font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
          Retention policy update
        </h2>
        <span className="ml-auto text-[13px] text-neutral-500 dark:text-neutral-400">
          Repo maintenance agent
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <main
          ref={body.ref}
          onScroll={body.onScroll}
          className="h-full overflow-y-auto p-4 sm:p-6"
        >
          <div className="flex min-h-full items-center">
            <motion.section
              {...enter}
              aria-labelledby="aa2-title"
              className="mx-auto w-full max-w-2xl space-y-1 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950 sm:px-5 sm:py-5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cx(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      decision === "pending"
                        ? "bg-amber-500"
                        : "bg-neutral-300 dark:bg-neutral-600",
                    )}
                  />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    {decision === "pending"
                      ? "Needs approval"
                      : decision === "denied"
                        ? "Skipped"
                        : decision === "always"
                          ? "Always allowed"
                          : "Approved"}
                  </span>
                </div>
                <h2
                  id="aa2-title"
                  className="mt-2 text-lg font-medium leading-snug tracking-[-0.015em] text-neutral-900 dark:text-neutral-100 sm:text-xl"
                >
                  Change the invoice retention window from 180 to 45 days
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Applies to the finance workspace. Invoice drafts older than 45
                  days will be purged nightly; posted invoices are never
                  touched.
                </p>

                <dl className="mt-4 flex flex-col">
                  {CHANGES.map((change) => (
                    <div
                      key={change.label}
                      className="flex min-h-9 items-center gap-3 py-1.5"
                    >
                      <dt className="min-w-0 flex-1 truncate text-[13px] text-neutral-600 dark:text-neutral-400">
                        {change.label}
                      </dt>
                      <dd className="flex shrink-0 items-center gap-2 text-[13px] tabular-nums">
                        <span className="text-neutral-500 line-through dark:text-neutral-500">
                          {change.from}
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-600"
                        />
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {change.to}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
                {decision === "pending" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPatch((v) => !v)}
                        aria-expanded={showPatch}
                        className={cx(
                          "inline-flex h-8 cursor-pointer items-center gap-1 rounded-[var(--rb-r-sm,6px)] px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
                          press,
                          focusRing,
                        )}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={cx(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out",
                            showPatch && "rotate-90",
                          )}
                        />
                        {showPatch ? "Hide diff" : "Show diff"}
                      </button>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDecision("denied");
                            setAnnouncement("Skipped, not approved.");
                          }}
                          className={cx(
                            "inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] bg-neutral-100 px-2.5 text-[13px] font-medium text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
                            press,
                            focusRing,
                          )}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDecision("always");
                            setAnnouncement("Always allowed for this project.");
                          }}
                          className={cx(
                            "inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] bg-neutral-100 px-2.5 text-[13px] font-medium text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
                            press,
                            focusRing,
                          )}
                        >
                          Always allow
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDecision("once");
                            setAnnouncement(
                              "Approved. The policy was updated.",
                            );
                          }}
                          className={cx(
                            "inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] px-2.5 text-[13px] font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(20.5%_0_0))_90%,transparent)] dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))] dark:hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(100%_0_0))_90%,transparent)]",
                            press,
                            focusRing,
                          )}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                    {showPatch && (
                      <pre
                        tabIndex={0}
                        className={cx(
                          "mt-1 max-h-40 overflow-auto rounded-[var(--rb-r-sm,6px)] bg-neutral-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400",
                          focusRing,
                        )}
                      >
                        {RAW_PATCH}
                      </pre>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-8 items-center gap-2 px-2 py-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <p className="min-w-0 flex-1 text-[13px] text-neutral-600 dark:text-neutral-400">
                      {settledLine}
                    </p>
                  </div>
                )}
              </div>
            </motion.section>
          </div>
        </main>

        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-200 ease-out dark:from-neutral-950",
            body.edges.start ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-200 ease-out dark:from-neutral-950",
            body.edges.end ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
