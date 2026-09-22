"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

type StepState = "done" | "running" | "paused" | "queued" | "skipped";

type Step = {
  title: string;
  detail: string;
  target: string | null;
  estimate: string;
  /** Steps the reviewer removed from the run before it started. */
  skipped?: boolean;
};

const STEPS: Step[] = [
  {
    title: "Read the billing contract notes",
    detail: "Collected the pricing rules, renewal terms and license caps.",
    target: "docs/billing.md",
    estimate: "2 min",
  },
  {
    title: "Map the entitlement resolver",
    detail: "Traced how a key resolves to a tier before touching the branch.",
    target: "lib/registry-auth.ts",
    estimate: "3 min",
  },
  {
    title: "Patch the tier lookup",
    detail:
      "Adding the renewal fallback so expired keys keep access through the grace window, without changing the response shape.",
    target: "lib/registry-auth.ts",
    estimate: "6 min",
  },
  {
    title: "Add a renewal-grace test",
    detail: "Covers the expired-but-in-grace path from key to response.",
    target: "tests/entitlements.test.ts",
    estimate: "4 min",
  },
  {
    title: "Run the license checks",
    detail: "Verifies expired, starter, pro and ultimate keys each branch.",
    target: "npm test",
    estimate: "5 min",
  },
  {
    title: "Regenerate the entitlement fixtures",
    detail: "Skipped in review: the current fixtures already cover the change.",
    target: "scripts/fixtures.ts",
    estimate: "4 min",
    skipped: true,
  },
  {
    title: "Update the installation docs",
    detail: "Describes the renewal fallback in plain language.",
    target: "docs/installation.md",
    estimate: "3 min",
  },
];

const CURRENT = 2;

const STATE_LABEL: Record<StepState, string> = {
  done: "Done",
  running: "Running",
  paused: "Paused",
  queued: "Queued",
  skipped: "Skipped",
};

const DOT_TONE: Record<StepState, string> = {
  done: "bg-neutral-300 dark:bg-neutral-600",
  running:
    "animate-pulse bg-neutral-400 motion-reduce:animate-none dark:bg-neutral-500",
  paused: "bg-neutral-300 dark:bg-neutral-600",
  queued: "bg-neutral-300 dark:bg-neutral-600",
  skipped: "bg-neutral-300 dark:bg-neutral-600",
};

function stateFor(index: number, paused: boolean): StepState {
  if (STEPS[index]?.skipped) return "skipped";
  if (index < CURRENT) return "done";
  if (index === CURRENT) return paused ? "paused" : "running";
  return "queued";
}

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

export default function AgentPlan1() {
  const [paused, setPaused] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const steps = useScrollFade<HTMLOListElement>();

  const states = useMemo(
    () => STEPS.map((_, i) => stateFor(i, paused)),
    [paused],
  );

  const doneCount = states.filter((s) => s === "done").length;
  const progress = (doneCount / STEPS.length) * 100;
  const expanded = openIndex === null ? CURRENT : openIndex;

  return (
    <div className="relative flex h-full min-h-[560px] w-full flex-col overflow-hidden bg-white p-4 sm:p-6 dark:bg-neutral-950">
      <header className="mb-3 flex shrink-0 items-center gap-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
          Fix billing entitlements
        </h2>
        <div className="flex shrink-0 items-center gap-2.5">
          <div
            aria-hidden="true"
            className="h-1 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
          >
            <div
              className="h-full rounded-full bg-neutral-900 transition-[width] duration-slow ease-decelerate motion-reduce:transition-none dark:bg-neutral-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[13px] tabular-nums text-neutral-500 dark:text-neutral-400">
            {doneCount} of {STEPS.length} done
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--rb-r-md,8px)] bg-neutral-100 px-2.5 text-[13px] font-medium text-neutral-700 transition-[transform,background-color,color] duration-fast ease-decelerate hover:bg-neutral-200 hover:text-neutral-900 active:scale-[0.97] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
        >
          {paused ? (
            <Play aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Square
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 fill-current"
            />
          )}
          {paused ? "Resume" : "Stop"}
        </button>
      </header>

      <p className="sr-only" aria-live="polite">
        {paused
          ? `Paused on ${STEPS[CURRENT]?.title}.`
          : `Working on ${STEPS[CURRENT]?.title}.`}
      </p>

      <div className="flex min-h-0 flex-1 flex-col rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <ol
            ref={steps.ref}
            onScroll={steps.onScroll}
            className="h-full space-y-1 overflow-y-auto overscroll-contain p-2"
          >
            {STEPS.map((step, i) => {
              const state = states[i] ?? "queued";
              const isOpen = expanded === i;

              return (
                <li key={step.title}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? -1 : i)}
                    className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-[var(--rb-r-md,8px)] p-2 text-left transition-colors duration-fast ease-decelerate hover:bg-neutral-50 focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:hover:bg-neutral-900 dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--rb-r-sm,6px)] bg-neutral-100 text-xs tabular-nums text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500">
                      {i + 1}
                    </span>
                    <span
                      className={cx(
                        "min-w-0 flex-1 truncate text-[13px]",
                        state === "done" &&
                          "text-neutral-600 dark:text-neutral-400",
                        state === "skipped" &&
                          "text-neutral-400 line-through decoration-neutral-300 dark:text-neutral-600 dark:decoration-neutral-700",
                        state === "queued" &&
                          "text-neutral-500 dark:text-neutral-500",
                        (state === "running" || state === "paused") &&
                          "font-medium text-neutral-900 dark:text-neutral-100",
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="flex w-20 shrink-0 items-center justify-end gap-1.5">
                      <span
                        aria-hidden="true"
                        className={cx(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          DOT_TONE[state],
                        )}
                      />
                      <span className="text-[13px] text-neutral-600 dark:text-neutral-400">
                        {STATE_LABEL[state]}
                      </span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mx-2 mt-1 rounded-[var(--rb-r-md,8px)] border border-neutral-200/70 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                      <p className="text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                        {step.detail}
                      </p>
                      <dl className="mt-2.5 flex flex-wrap gap-x-8 gap-y-1 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <dt className="shrink-0 text-neutral-500 dark:text-neutral-500">
                            Target
                          </dt>
                          <dd className="min-w-0 truncate font-mono text-neutral-700 dark:text-neutral-300">
                            {step.target ?? (
                              <span className="font-sans text-neutral-400 dark:text-neutral-600">
                                -
                              </span>
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <dt className="shrink-0 text-neutral-500 dark:text-neutral-500">
                            Estimate
                          </dt>
                          <dd className="tabular-nums text-neutral-700 dark:text-neutral-300">
                            {step.estimate}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-base ease-decelerate dark:from-neutral-950",
              steps.edges.start ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-base ease-decelerate dark:from-neutral-950",
              steps.edges.end ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      </div>
    </div>
  );
}
