"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, Download, X } from "lucide-react";

const DOCUMENT = {
  id: "SOC2-2024",
  name: "SOC 2 Type II report",
  kind: "PDF",
  owner: "Priya Raman",
  size: "4.2 MB",
  updated: "Jun 18, 2024",
  source: "Vanta",
  retention: "7 years",
  status: "Current",
  summary:
    "Independent audit of security, availability, and confidentiality controls for the 2024 reporting period.",
  controls: [
    { id: "AC-2", name: "Account management" },
    { id: "CC6.1", name: "Logical access controls" },
    { id: "CC7.2", name: "Security monitoring" },
    { id: "A1.2", name: "Availability commitments" },
  ],
  history: [
    { date: "Jun 18, 2024", label: "Report uploaded by Priya Raman" },
    { date: "Jun 14, 2024", label: "Audit period closed" },
    { date: "Jan 2, 2024", label: "Evidence collection started" },
  ],
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement | null) {
  return Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
}

function useDialogFocus(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const doc = panel?.ownerDocument ?? document;

    (getFocusable(panel)[0] ?? panel)?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable(panel);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = doc.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    doc.addEventListener("keydown", onKeyDown);
    return () => doc.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (wasOpenRef.current && !open)
      triggerRef.current?.focus({ preventScroll: true });
    wasOpenRef.current = open;
  }, [open]);

  return { panelRef, triggerRef };
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

export default function AppDialog6() {
  const body = useScrollFade<HTMLDivElement>();
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const keyboardOpenRef = useRef(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const doc = DOCUMENT;
  const closeSheet = useCallback(() => setOpen(false), []);
  const { panelRef, triggerRef } = useDialogFocus(open, closeSheet);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const openSheet = () => {
    setToast(null);
    setKeyboardOpen(keyboardOpenRef.current);
    setOpen(true);
  };

  const sheetMotion =
    prefersReducedMotion || keyboardOpen
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.15 },
        }
      : {
          initial: { x: "100%" },
          animate: { x: 0 },
          exit: {
            x: "100%",
            transition: {
              duration: 0.22,
              ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
            },
          },
          transition: {
            duration: 0.32,
            ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
          },
        };

  const metadata = [
    { label: "Owner", value: doc.owner },
    { label: "File", value: `${doc.kind} · ${doc.size}` },
    { label: "Updated", value: doc.updated },
    { label: "Source", value: doc.source },
    { label: "Retention", value: doc.retention },
  ];

  return (
    <div className="relative flex h-full min-h-[640px] w-full items-center justify-center overflow-hidden bg-white p-4 sm:p-6 dark:bg-neutral-950">
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={() => {
          keyboardOpenRef.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            keyboardOpenRef.current = true;
        }}
        onClick={openSheet}
        className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 transition-[transform,background-color,border-color,color] duration-fast ease-decelerate hover:bg-neutral-50 focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
      >
        View evidence details
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="absolute inset-0 z-30 bg-neutral-950/40 backdrop-blur-[2px] dark:bg-neutral-950/60"
              onClick={closeSheet}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            />
            <motion.aside
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="app-dialog-6-title"
              tabIndex={-1}
              className="absolute inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-hidden rounded-l-[var(--rb-r-4xl,18px)] border-l border-neutral-200/70 bg-white shadow-e4 focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-900"
              {...sheetMotion}
            >
              <header className="flex h-14 shrink-0 items-center gap-3 bg-neutral-50 px-5 sm:px-6 dark:bg-neutral-900/60">
                <h2
                  id="app-dialog-6-title"
                  className="min-w-0 flex-1 truncate text-base font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100"
                >
                  {doc.name}
                </h2>
                <button
                  type="button"
                  aria-label="Close panel"
                  onClick={closeSheet}
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--rb-r-md,8px)] bg-neutral-100 text-neutral-500 transition-[transform,background-color,border-color,color] duration-fast ease-decelerate hover:bg-neutral-200 hover:text-neutral-900 active:scale-[0.97] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:bg-neutral-800 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
                >
                  <X aria-hidden="true" className="h-4 w-4 shrink-0" />
                </button>
              </header>

              <div className="relative min-h-0 flex-1">
                <div
                  ref={body.ref}
                  onScroll={body.onScroll}
                  className="h-full overflow-y-auto px-5 py-4 sm:px-6 sm:py-5"
                >
                  <div className="flex items-center gap-2 text-[13px] text-neutral-600 dark:text-neutral-400">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    {doc.status}
                    <span className="text-neutral-300 dark:text-neutral-700">
                      ·
                    </span>
                    <span className="truncate tabular-nums">{doc.id}</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {doc.summary}
                  </p>

                  <dl className="mt-4 space-y-1.5">
                    {metadata.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-4 rounded-[var(--rb-r-lg,10px)] bg-neutral-50 px-3 py-2.5 text-[13px] dark:bg-neutral-800/50"
                      >
                        <dt className="shrink-0 text-neutral-600 dark:text-neutral-400">
                          {row.label}
                        </dt>
                        <dd className="min-w-0 truncate font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <h3 className="mt-5 text-xs font-medium uppercase tracking-[0.04em] text-neutral-500 dark:text-neutral-400">
                    Controls covered
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {doc.controls.map((control) => (
                      <li
                        key={control.id}
                        className="inline-flex h-7 items-center gap-1.5 rounded-[var(--rb-r-sm,6px)] bg-neutral-50 px-2 text-xs text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-400"
                      >
                        <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                          {control.id}
                        </span>
                        {control.name}
                      </li>
                    ))}
                  </ul>

                  <h3 className="mt-5 text-xs font-medium uppercase tracking-[0.04em] text-neutral-500 dark:text-neutral-400">
                    History
                  </h3>
                  <ol className="mt-2 space-y-2.5">
                    {doc.history.map((event) => (
                      <li
                        key={event.date}
                        className="flex items-baseline gap-3 text-[13px]"
                      >
                        <span className="w-24 shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                          {event.date}
                        </span>
                        <span className="min-w-0 text-neutral-900 dark:text-neutral-100">
                          {event.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-base ease-decelerate dark:from-neutral-900 ${
                    body.edges.start ? "opacity-100" : "opacity-0"
                  }`}
                />
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-base ease-decelerate dark:from-neutral-900 ${
                    body.edges.end ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>

              <footer className="flex shrink-0 flex-col-reverse gap-2 bg-neutral-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 sm:py-5 dark:bg-neutral-900/60">
                <button
                  type="button"
                  onClick={() => setToast("Report archived")}
                  className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--rb-r-lg,10px)] border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-900 transition-[transform,background-color,border-color,color] duration-fast ease-decelerate hover:bg-neutral-50 active:scale-[0.97] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] sm:w-auto dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
                >
                  <Archive aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => setToast("Download started")}
                  className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--rb-r-lg,10px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] px-4 text-sm font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] transition-[transform,background-color,border-color,color] duration-fast ease-decelerate hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(20.5%_0_0))_90%,transparent)] active:scale-[0.97] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] sm:w-auto dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))] dark:hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(100%_0_0))_90%,transparent)] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
                >
                  <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Download
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div
        aria-live="polite"
        className="pointer-events-none absolute bottom-4 left-4 right-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-full sm:max-w-sm"
      >
        {toast && (
          <div className="pointer-events-auto rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-white p-3 shadow-e2 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
              {toast}
            </p>
            <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
              {doc.name} · {doc.kind} · {doc.size}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
