"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, Pause, Play, RefreshCw } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out";

const frame =
  "rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950";
const panel =
  "rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-900";

type Sync = {
  id: string;
  source: string;
  mark: string;
  target: string;
  rows: number;
  progress: number;
  state: "syncing" | "healthy" | "paused" | "error";
  last: string;
  note?: string;
};

const SEED: Sync[] = [
  {
    id: "s1",
    source: "Northwind",
    mark: "NW",
    target: "events.usage_rollups",
    rows: 41822,
    progress: 62,
    state: "syncing",
    last: "running now",
  },
  {
    id: "s2",
    source: "Alder",
    mark: "AL",
    target: "billing.invoices",
    rows: 1204,
    progress: 100,
    state: "healthy",
    last: "8 minutes ago",
  },
  {
    id: "s3",
    source: "Cedar Labs",
    mark: "CL",
    target: "ci.check_results",
    rows: 9640,
    progress: 100,
    state: "healthy",
    last: "22 minutes ago",
  },
  {
    id: "s4",
    source: "Meridian",
    mark: "MD",
    target: "storage.exports",
    rows: 318,
    progress: 41,
    state: "error",
    last: "1 hour ago",
    note: "Bucket rejected the write: missing s3:PutObject on the export prefix.",
  },
  {
    id: "s5",
    source: "Quarry",
    mark: "QR",
    target: "audit.entries",
    rows: 76210,
    progress: 100,
    state: "paused",
    last: "yesterday",
  },
];

const STATES = {
  syncing: {
    label: "Syncing",
    dot: "bg-[var(--rb-accent,oklch(20.5%_0_0))] dark:bg-[var(--rb-accent,oklch(100%_0_0))]",
    text: "text-neutral-600 dark:text-neutral-400",
  },
  healthy: {
    label: "Healthy",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-500",
  },
  paused: {
    label: "Paused",
    dot: "bg-neutral-300 dark:bg-neutral-600",
    text: "text-neutral-500 dark:text-neutral-400",
  },
  error: {
    label: "Failed",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
} as const;

export default function Integrations6() {
  const uid = useId();
  const reduce = useReducedMotion();
  const [rows, setRows] = useState(SEED);

  useEffect(() => {
    const t = window.setInterval(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.state === "syncing"
            ? {
                ...r,
                progress:
                  r.progress >= 100 ? 12 : Math.min(100, r.progress + 4),
                rows: r.rows + 137,
              }
            : r,
        ),
      );
    }, 900);
    return () => window.clearInterval(t);
  }, []);

  const counts = {
    healthy: rows.filter((r) => r.state === "healthy").length,
    syncing: rows.filter((r) => r.state === "syncing").length,
    error: rows.filter((r) => r.state === "error").length,
    paused: rows.filter((r) => r.state === "paused").length,
  };

  const toggle = (id: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              state:
                r.state === "paused"
                  ? "syncing"
                  : r.state === "error"
                    ? "syncing"
                    : "paused",
            }
          : r,
      ),
    );

  return (
    <div className="relative flex h-full min-h-[680px] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <header className="shrink-0 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-medium tracking-[-0.01em] text-neutral-900 dark:text-white">
              Sync status
            </h2>
            <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
              Five connected sources writing into the warehouse.
            </p>
          </div>
          <button
            type="button"
            className={cx(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--rb-r-md,8px)] border border-neutral-200 px-2.5 text-[13px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-300",
              "hover:bg-neutral-100 dark:hover:bg-neutral-900",
              transition,
              focus,
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Sync all
          </button>
        </div>

        <div
          className={cx(frame, "mt-4 grid grid-cols-2 gap-1 sm:grid-cols-4")}
        >
          {(
            [
              [
                "Healthy",
                counts.healthy,
                "text-emerald-600 dark:text-emerald-500",
              ],
              ["Syncing", counts.syncing, "text-neutral-900 dark:text-white"],
              ["Failed", counts.error, "text-red-600 dark:text-red-400"],
              [
                "Paused",
                counts.paused,
                "text-neutral-500 dark:text-neutral-400",
              ],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className={cx(panel, "px-3 py-2.5")}>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                {label}
              </p>
              <p
                className={cx(
                  "mt-0.5 text-[20px] leading-none tabular-nums",
                  tone,
                )}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {rows.map((r) => {
            const s = STATES[r.state];
            return (
              <li
                key={r.id}
                className="rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--rb-r-md,8px)] border border-neutral-200/70 bg-neutral-50 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                  >
                    {r.mark}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] text-neutral-900 dark:text-white">
                        {r.source}
                      </span>
                      <span
                        aria-hidden
                        className="text-neutral-300 dark:text-neutral-700"
                      >
                        →
                      </span>
                      <span className="truncate font-mono text-[12.5px] text-neutral-500 dark:text-neutral-400">
                        {r.target}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                      <span className="tabular-nums">
                        {r.rows.toLocaleString("en-US")}
                      </span>{" "}
                      rows · {r.last}
                    </p>
                  </div>

                  <span
                    className={cx(
                      "inline-flex shrink-0 items-center gap-1.5 text-[12px]",
                      s.text,
                    )}
                  >
                    <span
                      aria-hidden
                      className={cx(
                        "h-1.5 w-1.5 rounded-full",
                        s.dot,
                        r.state === "syncing" && !reduce && "animate-pulse",
                      )}
                    />
                    {s.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    aria-label={
                      r.state === "paused" || r.state === "error"
                        ? `Resume ${r.source}`
                        : `Pause ${r.source}`
                    }
                    className={cx(
                      "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--rb-r-md,8px)] border border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300",
                      "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                      transition,
                      focus,
                    )}
                  >
                    {r.state === "paused" || r.state === "error" ? (
                      <Play className="h-3.5 w-3.5" strokeWidth={1.75} />
                    ) : (
                      <Pause className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                  </button>
                </div>

                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <motion.div
                    animate={{ width: `${r.progress}%` }}
                    transition={{ duration: reduce ? 0 : 0.6, ease: "easeOut" }}
                    className={cx(
                      "h-full rounded-full",
                      r.state === "error"
                        ? "bg-red-500"
                        : r.state === "healthy"
                          ? "bg-emerald-500"
                          : r.state === "paused"
                            ? "bg-neutral-300 dark:bg-neutral-600"
                            : "bg-[var(--rb-accent,oklch(20.5%_0_0))] dark:bg-[var(--rb-accent,oklch(100%_0_0))]",
                    )}
                  />
                </div>

                {r.note && (
                  <p className="mt-2.5 flex items-start gap-2 rounded-[var(--rb-r-lg,10px)] bg-red-50 px-2.5 py-2 text-[12px] leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    <AlertTriangle
                      aria-hidden
                      className="mt-[2px] h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.75}
                    />
                    {r.note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-neutral-200 px-5 py-2.5 text-[12px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
        Warehouse reachable · checked 30 seconds ago
      </footer>
      <p className="sr-only" aria-live="polite" id={`${uid}-live`}>
        {counts.error} failing syncs
      </p>
    </div>
  );
}
