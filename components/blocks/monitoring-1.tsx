"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { area, curveMonotoneX, line } from "d3-shape";
import { ArrowDown, ArrowUp, MoreHorizontal, RefreshCw } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,opacity,transform] duration-fast ease-decelerate";

const frame =
  "rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950";
const panel =
  "rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-900";

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const wave = (seed: number, i: number) =>
  Math.sin(i * 0.7 + seed) * 0.5 + Math.sin(i * 0.23 + seed * 2.1) * 0.34;

const series = (seed: number, base: number, drift: number, count: number) =>
  Array.from({ length: count }, (_, i) =>
    Math.round(base * (1 + drift * (i / (count - 1)) + wave(seed, i) * 0.09)),
  );

const RANGES = ["1h", "24h", "7d"] as const;
type Range = (typeof RANGES)[number];

const POINTS: Record<Range, number> = { "1h": 12, "24h": 24, "7d": 28 };
const TICKS: Record<Range, string[]> = {
  "1h": ["09:00", "09:15", "09:30", "09:45", "10:00"],
  "24h": ["04:00", "08:00", "12:00", "16:00", "20:00"],
  "7d": ["Mon", "Wed", "Thu", "Sat", "Sun"],
};
const SINCE: Record<Range, string> = {
  "1h": "vs previous hour",
  "24h": "vs previous day",
  "7d": "vs previous week",
};

const KPIS = [
  { id: "req", label: "Requests", base: 1_284_000, drift: 0.151, unit: "" },
  { id: "err", label: "Error rate", base: 42, drift: -0.02, unit: "%" },
  { id: "p95", label: "p95 latency", base: 318, drift: 0.004, unit: "ms" },
  { id: "sat", label: "Saturation", base: 61, drift: 0.037, unit: "%" },
] as const;

const INCIDENTS = [
  {
    id: "i1",
    title: "Checkout API timeouts",
    severity: "Critical",
    tone: "danger" as const,
    service: "payments-edge",
    at: "09:12",
    body: "The charge endpoint exceeded its 8s budget on six consecutive calls, holding four orders at authorisation.",
  },
  {
    id: "i2",
    title: "Retry storm contained",
    severity: "Major",
    tone: "warning" as const,
    service: "invoice-worker",
    at: "08:47",
    body: "Backoff was applied after a vendor 503 spike, capping retries and draining the queued backlog.",
  },
  {
    id: "i3",
    title: "Search index degraded",
    severity: "Minor",
    tone: "resolved" as const,
    service: "search-api",
    at: "08:05",
    body: "Read latency on the embeddings index rose to 1.9s, slowing lookups for eleven minutes before recovering.",
  },
];

const DOT: Record<"danger" | "warning" | "resolved", string> = {
  danger: "bg-red-500",
  warning: "bg-amber-500",
  resolved: "bg-neutral-300 dark:bg-neutral-600",
};

function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    const view = el?.ownerDocument.defaultView;
    if (!el || !view?.ResizeObserver) return;
    const observer = new view.ResizeObserver(([entry]) => {
      if (!entry) return;
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

const format = (id: string, value: number) => {
  if (id === "req") return `${(value / 1000).toFixed(1)}k`;
  if (id === "err") return `${(value / 100).toFixed(2)}%`;
  if (id === "p95") return `${value}ms`;
  return `${value}%`;
};

function Throughput({
  data,
  ticks,
  active,
  onActiveChange,
}: {
  data: number[];
  ticks: string[];
  active: number | null;
  onActiveChange: (i: number | null) => void;
}) {
  const uid = useId();
  const fillId = `${uid}-fill`;
  const [ref, size] = useMeasure<HTMLDivElement>();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const height = 180;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = (max - min || 1) * 0.25;

  const x = useCallback(
    (i: number) => (i / (data.length - 1)) * Math.max(size.width - 2, 1) + 1,
    [data.length, size.width],
  );
  const y = useCallback(
    (v: number) =>
      height - 4 - ((v - min + pad) / (max - min + pad * 2)) * (height - 12),
    [max, min, pad],
  );

  const linePath =
    line<number>()
      .x((_, i) => x(i))
      .y((v) => y(v))
      .curve(curveMonotoneX)(data) ?? "";

  const areaPath =
    area<number>()
      .x((_, i) => x(i))
      .y0(height)
      .y1((v) => y(v))
      .curve(curveMonotoneX)(data) ?? "";

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const step = rect.width / (data.length - 1);
    onActiveChange(
      clamp(Math.round((clientX - rect.left) / step), 0, data.length - 1),
    );
  };

  return (
    <div>
      <div
        ref={ref}
        role="img"
        aria-label={`Request throughput, ${data.length} points`}
        tabIndex={0}
        onPointerMove={(e) => move(e.clientX)}
        onPointerLeave={() => onActiveChange(null)}
        onBlur={() => onActiveChange(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const from = active ?? data.length - 1;
            onActiveChange(
              clamp(
                from + (e.key === "ArrowLeft" ? -1 : 1),
                0,
                data.length - 1,
              ),
            );
          }
          if (e.key === "Escape") onActiveChange(null);
        }}
        style={{ touchAction: "pan-y", height }}
        className={cx(
          "relative cursor-crosshair rounded-[var(--rb-r-sm,6px)]",
          focus,
        )}
      >
        {size.width > 0 && (
          <svg
            width={size.width}
            height={height}
            className="overflow-visible text-neutral-900 dark:text-white"
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.12} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={0}
                x2={size.width}
                y1={height * f}
                y2={height * f}
                className="stroke-neutral-200 dark:stroke-neutral-800"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}

            <g
              style={{
                transform: mounted ? "scaleX(1)" : "scaleX(0)",
                transformBox: "fill-box",
                transformOrigin: "left",
              }}
              className="transition-transform duration-slow ease-decelerate motion-reduce:transition-none"
            >
              <path d={areaPath} fill={`url(#${fillId})`} />
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {active !== null && (
              <>
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={0}
                  y2={height}
                  className="stroke-neutral-300 dark:stroke-neutral-700"
                  strokeWidth={1}
                />
                <circle
                  cx={x(active)}
                  cy={y(data[active] ?? 0)}
                  r={3.5}
                  className="fill-neutral-900 stroke-white dark:fill-white dark:stroke-neutral-900"
                  strokeWidth={2}
                />
              </>
            )}
          </svg>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-neutral-400 tabular-nums">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function Monitoring1() {
  const [range, setRange] = useState<Range>("24h");
  const [active, setActive] = useState<number | null>(null);

  const kpis = useMemo(
    () =>
      KPIS.map((k, i) => ({
        ...k,
        values: series(1.4 + i * 2.3, k.base, k.drift, POINTS[range]),
      })),
    [range],
  );

  const throughput = useMemo(
    () => series(3.7, 1263, 0.124, POINTS[range]),
    [range],
  );

  const total = throughput.reduce((s, v) => s + v, 0);

  return (
    <div className="flex h-full min-h-[760px] w-full flex-col overflow-hidden bg-white p-4 sm:p-6 dark:bg-neutral-950">
      <div className={cx(frame, "flex min-h-0 flex-1 flex-col gap-1")}>
        <div
          className={cx(
            panel,
            "flex flex-wrap items-start justify-between gap-3 px-4 py-3.5",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
                Platform health
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-neutral-400 motion-reduce:animate-none dark:bg-neutral-500"
                />
                Live
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-neutral-500">
              Traffic, errors and saturation across every production service.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              role="tablist"
              aria-label="Time range"
              className="flex items-center gap-0.5 rounded-[var(--rb-r-lg,10px)] bg-neutral-100 p-1 dark:bg-neutral-800/60"
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={r === range}
                  onClick={() => {
                    setRange(r);
                    setActive(null);
                  }}
                  className={cx(
                    "inline-flex h-6 cursor-pointer items-center rounded-[var(--rb-r-sm,6px)] px-2.5 text-[12px] font-medium",
                    transition,
                    focus,
                    r === range
                      ? "bg-white text-neutral-900 shadow-e1 dark:bg-neutral-900 dark:text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Refresh"
              className={cx(
                "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800",
                transition,
                focus,
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => {
            const first = k.values[0] ?? 0;
            const latest = k.values[k.values.length - 1] ?? 0;
            const delta = first === 0 ? 0 : ((latest - first) / first) * 100;
            const up = delta >= 0;
            const good = k.id === "err" ? !up : up;
            return (
              <div key={k.id} className={cx(panel, "px-4 py-3.5")}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-[13px] text-neutral-500">
                    {k.label}
                  </span>
                  <button
                    type="button"
                    aria-label={`Options for ${k.label}`}
                    className={cx(
                      "-mt-1 -mr-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
                      transition,
                      focus,
                    )}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                  <p className="text-[26px] leading-none font-medium tracking-[-0.02em] text-neutral-900 tabular-nums dark:text-neutral-100">
                    {format(k.id, latest)}
                  </p>
                  <span
                    className={cx(
                      "inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums",
                      good
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-red-600 dark:text-red-500",
                    )}
                  >
                    {up ? (
                      <ArrowUp className="h-3 w-3" aria-hidden />
                    ) : (
                      <ArrowDown className="h-3 w-3" aria-hidden />
                    )}
                    {Math.abs(delta).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-2.5 truncate text-[12px] text-neutral-500 tabular-nums">
                  {SINCE[range]}: {format(k.id, first)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 gap-1 lg:grid-cols-[1fr_360px]">
          <div
            className={cx(panel, "flex min-h-[280px] flex-col p-4 lg:min-h-0")}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                  Request throughput
                </h3>
                <p className="mt-1.5 text-[22px] leading-none font-medium tracking-[-0.02em] text-neutral-900 tabular-nums dark:text-neutral-100">
                  {(active === null ? total : (throughput[active] ?? 0))
                    .toLocaleString("en-US")}
                </p>
              </div>
              <p className="shrink-0 text-[12px] text-neutral-500 tabular-nums">
                {active === null
                  ? `total, last ${range}`
                  : `point ${active + 1} of ${throughput.length}`}
              </p>
            </div>
            <div className="mt-3 min-h-0 flex-1">
              <Throughput
                data={throughput}
                ticks={TICKS[range]}
                active={active}
                onActiveChange={setActive}
              />
            </div>
          </div>

          <div className={cx(panel, "flex min-h-0 flex-col")}>
            <div className="px-4 py-3">
              <h3 className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                Incident activity
              </h3>
            </div>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
              {INCIDENTS.map((i) => (
                <li
                  key={i.id}
                  className="rounded-[var(--rb-r-md,8px)] bg-neutral-50 p-3 dark:bg-neutral-800/40"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                      {i.title}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
                      <span
                        aria-hidden
                        className={cx(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          DOT[i.tone],
                        )}
                      />
                      {i.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-neutral-500 tabular-nums">
                    {i.service} · {i.at}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {i.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
