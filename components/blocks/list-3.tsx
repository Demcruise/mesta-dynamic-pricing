"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Flag,
  KeyRound,
  LogIn,
  ScanFace,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  UserMinus,
} from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,opacity] duration-150 ease-out";

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

type Facet = "all" | "signin" | "permission" | "device";

type SecurityEvent = {
  id: string;
  kind: "signin" | "permission" | "device";
  icon: ComponentType<{ className?: string }>;
  title: string;
  actor: string;
  target: string;
  time: string;
  anomaly?: boolean;
};

type DayGroup = { day: string; events: SecurityEvent[] };

const FEED: DayGroup[] = [
  {
    day: "Today",
    events: [
      {
        id: "e-01",
        kind: "signin",
        icon: ShieldOff,
        title: "Impossible-travel sign-in blocked",
        actor: "priya.nair@northwind.co",
        target: "Kraków, PL then Austin, US in 22 min",
        time: "2m ago",
        anomaly: true,
      },
      {
        id: "e-02",
        kind: "device",
        icon: Smartphone,
        title: "New device approved",
        actor: "marcus.hale",
        target: "iPhone 15 · iOS 18.2",
        time: "16m ago",
      },
      {
        id: "e-03",
        kind: "permission",
        icon: ShieldCheck,
        title: "Role raised to Workspace admin",
        actor: "granted by dana.okafor",
        target: "for lars.eriksson",
        time: "48m ago",
      },
      {
        id: "e-04",
        kind: "permission",
        icon: KeyRound,
        title: "Personal access token issued",
        actor: "marcus.hale",
        target: "scope: repo, read:org · expires in 90d",
        time: "1h ago",
      },
      {
        id: "e-05",
        kind: "signin",
        icon: LogIn,
        title: "Sign-in from a new location",
        actor: "dana.okafor",
        target: "Lisbon, PT · Chrome on macOS",
        time: "2h ago",
      },
    ],
  },
  {
    day: "Yesterday",
    events: [
      {
        id: "e-06",
        kind: "permission",
        icon: ShieldCheck,
        title: "SSO enforcement enabled",
        actor: "dana.okafor",
        target: "SAML now required for all members",
        time: "18:24",
      },
      {
        id: "e-07",
        kind: "device",
        icon: Smartphone,
        title: "Device signed out remotely",
        actor: "revoked by dana.okafor",
        target: "Pixel 8 · last seen 6d ago",
        time: "14:07",
      },
      {
        id: "e-08",
        kind: "permission",
        icon: UserMinus,
        title: "Member removed from workspace",
        actor: "removed by dana.okafor",
        target: "contractor.wei, access revoked",
        time: "11:52",
      },
      {
        id: "e-09",
        kind: "signin",
        icon: ScanFace,
        title: "Passkey enrolled",
        actor: "lars.eriksson",
        target: "Touch ID · MacBook Pro",
        time: "09:31",
      },
    ],
  },
  {
    day: "Tue 3 Feb",
    events: [
      {
        id: "e-10",
        kind: "permission",
        icon: KeyRound,
        title: "API key rotated",
        actor: "automation · nightly job",
        target: "billing-service, previous key revoked",
        time: "03:00",
      },
      {
        id: "e-11",
        kind: "signin",
        icon: LogIn,
        title: "Sign-in from a trusted device",
        actor: "priya.nair",
        target: "Kraków, PL · Firefox on Windows",
        time: "08:14",
      },
      {
        id: "e-12",
        kind: "permission",
        icon: ShieldCheck,
        title: "Recovery codes regenerated",
        actor: "marcus.hale",
        target: "10 new single-use codes",
        time: "16:45",
      },
    ],
  },
];

const FILTERS: { id: Facet; label: string }[] = [
  { id: "all", label: "All" },
  { id: "signin", label: "Sign-ins" },
  { id: "permission", label: "Permissions" },
  { id: "device", label: "Devices" },
];

export default function List3() {
  const [facet, setFacet] = useState<Facet>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fade = useScrollFade<HTMLDivElement>();

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const groups = useMemo(() => {
    if (facet === "all" && !flaggedOnly) return FEED;
    return FEED.map((group) => ({
      day: group.day,
      events: group.events.filter(
        (event) =>
          (facet === "all" || event.kind === facet) &&
          (!flaggedOnly || event.anomaly === true),
      ),
    })).filter((group) => group.events.length > 0);
  }, [facet, flaggedOnly]);

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.events.length, 0),
    [groups],
  );

  let rowIndex = -1;

  return (
    <div className="flex h-full min-h-[640px] w-full flex-col justify-center overflow-y-auto bg-white p-8 sm:p-10 dark:bg-neutral-950">
      <div className="mx-auto flex w-full max-w-[720px] flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-medium tracking-[-0.015em] text-neutral-900 dark:text-neutral-100">
              Security activity
            </h2>
            <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-500">
              Access, sign-in and permission events across the workspace.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={flaggedOnly}
              onClick={() => setFlaggedOnly((v) => !v)}
              className={cx(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[var(--rb-r-lg,10px)] border px-3 text-[13px] active:scale-[0.97]",
                flaggedOnly
                  ? "border-neutral-900 bg-[var(--rb-accent,oklch(20.5%_0_0))] font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] dark:border-white dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))]"
                  : "border-neutral-200/70 bg-neutral-100 text-neutral-600 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                transition,
                focus,
              )}
            >
              <Flag aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Flagged
            </button>

            <div
              role="tablist"
              aria-label="Filter events"
              className="flex h-9 shrink-0 items-center gap-1 rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900"
            >
              {FILTERS.map((filter) => {
                const active = facet === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFacet(filter.id)}
                    className={cx(
                      "inline-flex h-7 cursor-pointer items-center rounded-[var(--rb-r-sm,6px)] px-2.5 text-[13px] active:scale-[0.97]",
                      active
                        ? "bg-white font-medium text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                      transition,
                      focus,
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative mt-4 min-h-0 overflow-hidden rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          <div
            ref={fade.ref}
            onScroll={fade.onScroll}
            className="h-[422px] overflow-y-auto"
          >
            {total === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-5 w-5 text-neutral-400 dark:text-neutral-600"
                  />
                </span>
                <p className="mt-3 text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                  No matching events
                </p>
                <p className="mt-1 max-w-[36ch] text-[13px] text-neutral-500 dark:text-neutral-500">
                  Nothing matches this category and flag combination.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFacet("all");
                    setFlaggedOnly(false);
                  }}
                  className={cx(
                    "mt-4 inline-flex h-8 cursor-pointer items-center rounded-[var(--rb-r-md,8px)] border border-neutral-200/70 bg-white px-3 text-[13px] font-medium text-neutral-900 hover:bg-neutral-50 active:scale-[0.97] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800",
                    transition,
                    focus,
                  )}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.day}>
                  <div className="sticky top-0 z-10 bg-neutral-50 px-3 pb-1.5 pt-2 text-[11px] font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500">
                    {group.day}
                  </div>
                  <ul className="flex flex-col gap-1 px-0 pb-1">
                    {group.events.map((event) => {
                      rowIndex += 1;
                      const Icon = event.icon;
                      const delay = `${Math.min(rowIndex, 7) * 20}ms`;
                      return (
                        <li
                          key={event.id}
                          style={{ transitionDelay: mounted ? "0ms" : delay }}
                          className={cx(
                            "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                            mounted
                              ? "translate-y-0 opacity-100"
                              : "translate-y-1 opacity-0",
                          )}
                        >
                          <div
                            className={cx(
                              "flex h-14 items-center gap-3 rounded-[var(--rb-r-lg,10px)] border bg-white px-3 hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900",
                              event.anomaly
                                ? "border-red-500/40 dark:border-red-500/30"
                                : "border-neutral-200/70 dark:border-neutral-800",
                              transition,
                            )}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--rb-r-md,8px)] bg-neutral-100 dark:bg-neutral-900">
                              <Icon
                                aria-hidden="true"
                                className={cx(
                                  "h-[18px] w-[18px]",
                                  event.anomaly
                                    ? "text-red-600 dark:text-red-500"
                                    : "text-neutral-500 dark:text-neutral-500",
                                )}
                              />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                                  {event.title}
                                </p>
                                {event.anomaly && (
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-500">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                                    Blocked
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-[12px] text-neutral-500 dark:text-neutral-500">
                                <span className="text-neutral-600 dark:text-neutral-400">
                                  {event.actor}
                                </span>{" "}
                                · {event.target}
                              </p>
                            </div>

                            <time className="shrink-0 text-[12px] tabular-nums text-neutral-500 dark:text-neutral-500">
                              {event.time}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>

          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-1 top-1 z-20 h-8 rounded-t-[var(--rb-r-lg,10px)] bg-gradient-to-b from-neutral-50 to-transparent transition-opacity duration-200 ease-out dark:from-neutral-900",
              fade.edges.start ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-1 bottom-1 z-20 h-8 rounded-b-[var(--rb-r-lg,10px)] bg-gradient-to-t from-neutral-50 to-transparent transition-opacity duration-200 ease-out dark:from-neutral-900",
              fade.edges.end ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        <p className="mt-3 px-1 text-[12px] tabular-nums text-neutral-500 dark:text-neutral-500">
          {total} {total === 1 ? "event" : "events"} shown
        </p>
      </div>
    </div>
  );
}
