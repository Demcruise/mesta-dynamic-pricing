"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  Check,
  CircleHelp,
  Command,
  LogOut,
  Plus,
  Search,
  Settings,
  Square,
  User,
  X,
} from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out";

const surface =
  "rounded-[var(--rb-r-xl,12px)] border border-neutral-200 bg-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] dark:border-neutral-800 dark:bg-neutral-900";

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const pop = (reduce: boolean | null) => ({
  initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 },
  animate: reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 },
  exit: reduce
    ? { opacity: 0, transition: { duration: 0.12 } }
    : {
        opacity: 0,
        scale: 0.97,
        y: -4,
        transition: { duration: 0.12, ease: EASE_OUT },
      },
  transition: { duration: 0.18, ease: EASE_OUT },
});

const menuItem =
  "flex w-full cursor-pointer items-center gap-2 rounded-[var(--rb-r-md,8px)] px-2.5 py-1.5 text-left text-[13px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800";

const iconButton =
  "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--rb-r-md,8px)] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

const NOTICES = [
  {
    id: "n1",
    who: "Nadia V.",
    text: "requested review on Billing retry policy",
    at: "4m",
  },
  {
    id: "n2",
    who: "Deploy bot",
    text: "shipped web-app 24.6.1 to production",
    at: "26m",
  },
  {
    id: "n3",
    who: "Marcus S.",
    text: "left three comments on Checkout copy",
    at: "1h",
  },
  {
    id: "n4",
    who: "Harbor Coffee",
    text: "upgraded to the Scale plan",
    at: "3h",
  },
];

const RESULTS = [
  "Billing retry policy",
  "Checkout drop-off study",
  "Q3 pricing experiment",
  "Webhook signing keys",
];

export default function Navbar6() {
  const reduce = useReducedMotion();
  const [menu, setMenu] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [read, setRead] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.("[data-menu-root]")) setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    doc.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("keydown", onKeyDown);
    return () => {
      doc.removeEventListener("pointerdown", onPointerDown);
      doc.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const open = (id: string) => {
    setMenu((m) => (m === id ? null : id));
  };

  const unread = NOTICES.filter((n) => !read.includes(n.id));
  const matches = RESULTS.filter((r) =>
    r.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-[480px] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950"
    >
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 px-3 sm:px-4 dark:border-neutral-800">
        <a
          href="#"
          className={cx(
            "inline-flex shrink-0 items-center gap-2 rounded-[var(--rb-r-md,8px)]",
            focus,
          )}
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--rb-r-md,8px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] text-[var(--rb-accent-fg,oklch(100%_0_0))] dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))]"
          >
            <Square className="h-3.5 w-3.5" />
          </span>
          <span className="hidden text-[14px] font-semibold tracking-[-0.015em] text-neutral-900 sm:block dark:text-neutral-100">
            Northwind
          </span>
        </a>

        <div
          className={cx(
            "relative mx-auto w-full max-w-[420px]",
            searchOpen ? "block" : "hidden sm:block",
          )}
          data-menu-root
        >
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
          <label htmlFor="navbar-6-search" className="sr-only">
            Search Northwind
          </label>
          <input
            id="navbar-6-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setMenu("search");
            }}
            placeholder="Search projects, docs and people…"
            className={cx(
              "h-9 w-full rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-neutral-50 pr-16 pl-8 text-[13px] text-neutral-900 placeholder:text-neutral-500 hover:border-neutral-300 focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white",
              transition,
              focus,
            )}
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded-[var(--rb-r-sm,6px)] border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-500 md:inline-flex dark:border-neutral-700 dark:bg-neutral-950">
            <Command aria-hidden className="h-3 w-3" />K
          </kbd>

          <AnimatePresence>
            {menu === "search" && (
              <motion.div
                {...pop(reduce)}
                className={cx(
                  surface,
                  "absolute top-full right-0 left-0 z-30 mt-1.5 origin-top p-1",
                )}
              >
                <p className="px-2.5 py-1.5 text-[11px] font-medium tracking-[0.08em] text-neutral-400 uppercase">
                  {query ? "Results" : "Recent"}
                </p>
                {matches.length === 0 ? (
                  <p className="px-2.5 py-3 text-center text-[12px] text-neutral-500">
                    Nothing matches “{query}”.
                  </p>
                ) : (
                  matches.map((r, i) => (
                    <motion.button
                      key={r}
                      type="button"
                      layout={reduce ? false : "position"}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.18,
                        ease: EASE_OUT,
                        delay: reduce ? 0 : Math.min(i * 0.03, 0.15),
                      }}
                      onClick={() => {
                        setQuery(r);
                        setMenu(null);
                      }}
                      className={cx(menuItem, transition, focus)}
                    >
                      <Search
                        aria-hidden
                        className="h-3.5 w-3.5 text-neutral-400"
                      />
                      <span className="min-w-0 flex-1 truncate">{r}</span>
                    </motion.button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Open search"}
            onClick={() => setSearchOpen((s) => !s)}
            className={cx(iconButton, "sm:hidden", transition, focus)}
          >
            {searchOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            className={cx(
              "hidden h-9 cursor-pointer items-center gap-1.5 rounded-[var(--rb-r-md,8px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] px-3 text-[13px] font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(20.5%_0_0))_90%,transparent)] active:scale-[0.97] sm:inline-flex dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))] dark:hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(100%_0_0))_90%,transparent)]",
              transition,
              focus,
            )}
          >
            <Plus aria-hidden className="h-3.5 w-3.5" />
            New
          </button>

          <button
            type="button"
            aria-label="Help"
            className={cx(
              iconButton,
              "hidden md:inline-flex",
              transition,
              focus,
            )}
          >
            <CircleHelp className="h-4 w-4" />
          </button>

          <div className="relative" data-menu-root>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu === "bell"}
              aria-label={`Notifications, ${unread.length} unread`}
              onClick={() => open("bell")}
              className={cx(iconButton, "relative", transition, focus)}
            >
              <Bell className="h-4 w-4" />
              {unread.length > 0 && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--rb-accent,oklch(20.5%_0_0))] ring-2 ring-white dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:ring-neutral-950"
                />
              )}
            </button>
            <AnimatePresence>
              {menu === "bell" && (
                <motion.div
                  {...pop(reduce)}
                  className={cx(
                    surface,
                    "absolute top-full right-0 z-30 mt-1.5 w-[300px] origin-top-right",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                      Notifications
                    </p>
                    <button
                      type="button"
                      onClick={() => setRead(NOTICES.map((n) => n.id))}
                      className={cx(
                        "cursor-pointer rounded-[var(--rb-r-sm,6px)] text-[12px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100",
                        transition,
                        focus,
                      )}
                    >
                      Mark all read
                    </button>
                  </div>
                  <ul className="max-h-[240px] overflow-y-auto p-1">
                    {NOTICES.map((n) => {
                      const isRead = read.includes(n.id);
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setRead((r) =>
                                r.includes(n.id) ? r : [...r, n.id],
                              )
                            }
                            className={cx(
                              "flex w-full cursor-pointer items-start gap-2 rounded-[var(--rb-r-md,8px)] px-2.5 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800",
                              transition,
                              focus,
                            )}
                          >
                            <span
                              aria-hidden
                              className={cx(
                                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                                isRead
                                  ? "bg-transparent"
                                  : "bg-[var(--rb-accent,oklch(20.5%_0_0))] dark:bg-[var(--rb-accent,oklch(100%_0_0))]",
                              )}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  "block text-[13px] leading-snug",
                                  isRead
                                    ? "text-neutral-500"
                                    : "text-neutral-900 dark:text-neutral-100",
                                )}
                              >
                                <span className="font-medium">{n.who}</span>{" "}
                                {n.text}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-neutral-400 tabular-nums">
                                {n.at} ago
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {unread.length === 0 && (
                    <p className="flex items-center justify-center gap-1.5 border-t border-neutral-200 px-3 py-2 text-[12px] text-neutral-500 dark:border-neutral-800">
                      <Check aria-hidden className="h-3.5 w-3.5" />
                      You are all caught up
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" data-menu-root>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu === "account"}
              aria-label="Account menu"
              onClick={() => open("account")}
              className={cx(
                "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700",
                transition,
                focus,
              )}
            >
              EM
            </button>
            <AnimatePresence>
              {menu === "account" && (
                <motion.div
                  {...pop(reduce)}
                  role="menu"
                  className={cx(
                    surface,
                    "absolute top-full right-0 z-30 mt-1.5 w-[210px] origin-top-right p-1",
                  )}
                >
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                      Elena Marsh
                    </p>
                    <p className="truncate text-[12px] text-neutral-500">
                      Workspace admin
                    </p>
                  </div>
                  <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                  <button
                    type="button"
                    role="menuitem"
                    className={cx(menuItem, transition, focus)}
                  >
                    <User aria-hidden className="h-3.5 w-3.5" />
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={cx(menuItem, transition, focus)}
                  >
                    <Settings aria-hidden className="h-3.5 w-3.5" />
                    Preferences
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={cx(menuItem, transition, focus)}
                  >
                    <LogOut aria-hidden className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
          Today
        </h2>
        <ul className="mt-3 space-y-1">
          {NOTICES.map((n) => (
            <li
              key={n.id}
              className="flex items-center justify-between gap-3 rounded-[var(--rb-r-lg,10px)] bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900/60"
            >
              <span className="min-w-0 truncate text-[13px] text-neutral-700 dark:text-neutral-300">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {n.who}
                </span>{" "}
                {n.text}
              </span>
              <span className="shrink-0 text-[12px] text-neutral-400 tabular-nums">
                {n.at} ago
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
