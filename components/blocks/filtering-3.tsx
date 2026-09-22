"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, Check, Filter, Plus, Search, X } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,transform] duration-150 ease-out";

const field =
  "h-9 w-full rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors duration-150 hover:border-neutral-300 focus:border-neutral-900 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:hover:border-neutral-700 dark:focus:border-white";

type SelectOption = { value: string; label: string; hint?: string };

function Select({
  id,
  value,
  onChange,
  options,
  disabled,
  placeholder = "Select…",
  className,
  triggerClassName,
  leading,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  leading?: ReactNode;
  ariaLabel?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [flip, setFlip] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openList = (index?: number) => {
    if (disabled) return;
    const node = rootRef.current;
    const win = node?.ownerDocument.defaultView;
    if (node && win) {
      const r = node.getBoundingClientRect();
      const room = win.innerHeight - r.bottom;
      const needed = Math.min(options.length * 32 + 8, 264);
      setFlip(room < needed + 8 && r.top > room);
    }
    setActive(index ?? (selectedIndex >= 0 ? selectedIndex : 0));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const node = rootRef.current;
    const doc = node?.ownerDocument;
    if (!doc) return;
    const onPointer = (e: Event) => {
      if (!node.contains(e.target as Node)) setOpen(false);
    };
    doc.addEventListener("mousedown", onPointer);
    doc.addEventListener("touchstart", onPointer);
    return () => {
      doc.removeEventListener("mousedown", onPointer);
      doc.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [open, active]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    rootRef.current?.querySelector("button")?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(active);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      const t = typeahead.current;
      t.buffer = now - t.at > 700 ? e.key : t.buffer + e.key;
      t.at = now;
      const hit = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(t.buffer.toLowerCase()),
      );
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        className={cx(
          field,
          "flex cursor-pointer items-center justify-between gap-2 pr-2.5 text-left",
          focus,
          "focus-visible:outline-offset-[-2px]",
          open && "border-neutral-900 dark:border-white",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {leading}
          <span
            className={cx(
              "truncate",
              !selected && "text-neutral-400 dark:text-neutral-500",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cx(
            "h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-150 ease-out motion-reduce:transition-none dark:text-neutral-600",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className={cx(
            "absolute z-30 max-h-[264px] w-full overflow-y-auto rounded-[var(--rb-r-lg,10px)] border border-neutral-200 bg-white p-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] dark:border-neutral-800 dark:bg-neutral-900",
            flip ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
                className={cx(
                  "flex h-8 cursor-pointer items-center justify-between gap-2 rounded-[var(--rb-r-sm,6px)] px-2.5 text-sm text-neutral-900 dark:text-neutral-100",
                  i === active && "bg-neutral-100 dark:bg-neutral-800",
                )}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate">{o.label}</span>
                  {o.hint && (
                    <span className="shrink-0 text-xs text-neutral-500">
                      {o.hint}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <Check
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-neutral-900 dark:text-white"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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

type Deal = {
  id: string;
  name: string;
  company: string;
  stage: string;
  owner: string;
  value: number;
  close: string;
  probability: number;
};

const STAGES: SelectOption[] = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

type Owner = { value: string; label: string; initials: string };

const OWNERS: Owner[] = [
  { value: "amara", label: "Amara Osei", initials: "AO" },
  { value: "raj", label: "Raj Patel", initials: "RP" },
  { value: "lena", label: "Lena Fischer", initials: "LF" },
  { value: "marco", label: "Marco Bianchi", initials: "MB" },
];

const OWNER_OPTIONS: SelectOption[] = OWNERS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const DEALS: Deal[] = [
  {
    id: "d1",
    name: "Harborline renewal",
    company: "Harborline Supply",
    stage: "negotiation",
    owner: "amara",
    value: 48000,
    close: "Aug 14",
    probability: 70,
  },
  {
    id: "d2",
    name: "Meridian expansion",
    company: "Meridian Labs",
    stage: "proposal",
    owner: "raj",
    value: 32000,
    close: "Aug 22",
    probability: 55,
  },
  {
    id: "d3",
    name: "Kestrel pilot",
    company: "Kestrel Robotics",
    stage: "qualified",
    owner: "lena",
    value: 12000,
    close: "Sep 03",
    probability: 30,
  },
  {
    id: "d4",
    name: "Foxglove migration",
    company: "Foxglove Media",
    stage: "negotiation",
    owner: "marco",
    value: 76000,
    close: "Aug 09",
    probability: 80,
  },
  {
    id: "d5",
    name: "Anvil onboarding",
    company: "Anvil Logistics",
    stage: "lead",
    owner: "amara",
    value: 8000,
    close: "Sep 18",
    probability: 15,
  },
  {
    id: "d6",
    name: "Cobalt upsell",
    company: "Cobalt Health",
    stage: "proposal",
    owner: "raj",
    value: 21000,
    close: "Aug 28",
    probability: 50,
  },
  {
    id: "d7",
    name: "Rivermark deal",
    company: "Rivermark Foods",
    stage: "won",
    owner: "lena",
    value: 54000,
    close: "Jul 30",
    probability: 100,
  },
  {
    id: "d8",
    name: "Two Rivers expansion",
    company: "Two Rivers Coffee",
    stage: "qualified",
    owner: "marco",
    value: 15500,
    close: "Sep 11",
    probability: 35,
  },
  {
    id: "d9",
    name: "Stonepath platform",
    company: "Stonepath Systems",
    stage: "negotiation",
    owner: "amara",
    value: 120000,
    close: "Aug 05",
    probability: 65,
  },
  {
    id: "d10",
    name: "Verdant build",
    company: "Verdant Studio",
    stage: "lead",
    owner: "raj",
    value: 6500,
    close: "Sep 25",
    probability: 10,
  },
  {
    id: "d11",
    name: "Silt & Vine renewal",
    company: "Silt & Vine",
    stage: "proposal",
    owner: "lena",
    value: 28000,
    close: "Aug 19",
    probability: 60,
  },
  {
    id: "d12",
    name: "Summit Chalet retrofit",
    company: "Summit Chalet",
    stage: "lost",
    owner: "marco",
    value: 40000,
    close: "Jul 22",
    probability: 0,
  },
  {
    id: "d13",
    name: "Skyward rollout",
    company: "Skyward Air",
    stage: "negotiation",
    owner: "amara",
    value: 95000,
    close: "Aug 12",
    probability: 75,
  },
  {
    id: "d14",
    name: "Marginalia upgrade",
    company: "Marginalia Press",
    stage: "qualified",
    owner: "raj",
    value: 18000,
    close: "Sep 08",
    probability: 40,
  },
  {
    id: "d15",
    name: "Longitude booking suite",
    company: "Longitude Travel",
    stage: "proposal",
    owner: "lena",
    value: 24500,
    close: "Aug 30",
    probability: 45,
  },
  {
    id: "d16",
    name: "Thornbury financing",
    company: "Thornbury Bank",
    stage: "won",
    owner: "marco",
    value: 67000,
    close: "Jul 28",
    probability: 100,
  },
  {
    id: "d17",
    name: "Halden Research POC",
    company: "Halden Research",
    stage: "lead",
    owner: "amara",
    value: 9500,
    close: "Sep 20",
    probability: 20,
  },
  {
    id: "d18",
    name: "Fine Arts curriculum",
    company: "Fine Arts Collective",
    stage: "qualified",
    owner: "raj",
    value: 13500,
    close: "Sep 14",
    probability: 25,
  },
];

type FieldKind = "enum" | "text" | "number";

type FieldDef = {
  value: keyof Deal;
  label: string;
  kind: FieldKind;
  operators: string[];
  options?: SelectOption[];
};

const FIELDS: FieldDef[] = [
  {
    value: "stage",
    label: "Stage",
    kind: "enum",
    operators: ["is", "is_not"],
    options: STAGES,
  },
  {
    value: "owner",
    label: "Owner",
    kind: "enum",
    operators: ["is", "is_not"],
    options: OWNER_OPTIONS,
  },
  {
    value: "company",
    label: "Company",
    kind: "text",
    operators: ["contains", "not_contains"],
  },
  {
    value: "value",
    label: "Deal value",
    kind: "number",
    operators: ["gt", "lt"],
  },
  {
    value: "probability",
    label: "Probability",
    kind: "number",
    operators: ["gt", "lt"],
  },
];

const OPERATOR_LABELS: Record<string, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  gt: "greater than",
  lt: "less than",
};

const FIELD_OPTIONS: SelectOption[] = FIELDS.map((f) => ({
  value: f.value,
  label: f.label,
}));

const fieldDef = (key: keyof Deal) =>
  FIELDS.find((f) => f.value === key) as FieldDef;

type Query = {
  id: string;
  field: keyof Deal;
  operator: string;
  value: string;
};

const grouped = (n: number) =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (n: number) => `$${grouped(n)}`;

const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

const defaultValueFor = (key: keyof Deal): string => {
  const def = fieldDef(key);
  if (def.kind === "enum") return def.options?.[0]?.value ?? "";
  return "";
};

let seq = 0;
const nextId = () => `q${(seq += 1)}`;

const applies = (deal: Deal, q: Query): boolean => {
  const def = fieldDef(q.field);
  if (def.kind === "enum") {
    const cell = String(deal[q.field]);
    if (q.operator === "is") return cell === q.value;
    return cell !== q.value;
  }
  if (def.kind === "text") {
    const raw = q.value.trim().toLowerCase();
    if (!raw) return true;
    const cell = String(deal[q.field]).toLowerCase();
    if (q.operator === "contains") return cell.includes(raw);
    return !cell.includes(raw);
  }
  if (q.value.trim() === "") return true;
  const n = Number(q.value);
  if (Number.isNaN(n)) return true;
  const cell = Number(deal[q.field]);
  if (q.operator === "gt") return cell > n;
  return cell < n;
};

const queryValueLabel = (q: Query): string => {
  const def = fieldDef(q.field);
  if (def.kind === "enum")
    return def.options?.find((o) => o.value === q.value)?.label ?? q.value;
  if (q.value.trim() === "") return "…";
  if (def.kind === "number" && q.field === "value")
    return money(Number(q.value));
  if (def.kind === "number" && q.field === "probability") return `${q.value}%`;
  return q.value;
};

type View = { value: string; label: string; build: () => Query[] };

const VIEWS: View[] = [
  { value: "all", label: "All deals", build: () => [] },
  {
    value: "mine",
    label: "My deals",
    build: () => [
      { id: nextId(), field: "owner", operator: "is", value: "amara" },
    ],
  },
  {
    value: "late",
    label: "Late stage",
    build: () => [
      { id: nextId(), field: "stage", operator: "is", value: "negotiation" },
    ],
  },
  {
    value: "high",
    label: "High value",
    build: () => [
      { id: nextId(), field: "value", operator: "gt", value: "50000" },
    ],
  },
];

export default function Filtering3() {
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const {
    ref: tableRef,
    edges: tableEdges,
    onScroll: onTableScroll,
  } = useScrollFade<HTMLDivElement>();

  const [view, setView] = useState("all");
  const [queries, setQueries] = useState<Query[]>(() => [
    { id: nextId(), field: "stage", operator: "is_not", value: "lost" },
    { id: nextId(), field: "value", operator: "gt", value: "10000" },
  ]);
  const [search, setSearch] = useState("");
  const [openPop, setOpenPop] = useState<string | null>(null);

  useEffect(() => {
    if (!openPop) return;
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;
    const onDown = (e: Event) => {
      if (popRef.current && !popRef.current.contains(e.target as Node))
        setOpenPop(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPop(null);
    };
    doc.addEventListener("mousedown", onDown);
    doc.addEventListener("touchstart", onDown);
    doc.addEventListener("keydown", onKey);
    return () => {
      doc.removeEventListener("mousedown", onDown);
      doc.removeEventListener("touchstart", onDown);
      doc.removeEventListener("keydown", onKey);
    };
  }, [openPop]);

  const selectView = (v: string) => {
    setView(v);
    const preset = VIEWS.find((x) => x.value === v);
    setQueries(preset ? preset.build() : []);
    setOpenPop(null);
  };

  const addFilter = (key: keyof Deal) => {
    const def = fieldDef(key);
    const q: Query = {
      id: nextId(),
      field: key,
      operator: def.operators[0] ?? "",
      value: defaultValueFor(key),
    };
    setQueries((prev) => [...prev, q]);
    setView("");
    setOpenPop(q.id);
  };

  const patchQuery = (id: string, patch: Partial<Query>) => {
    setQueries((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
    setView("");
  };

  const changeField = (id: string, key: keyof Deal) => {
    const def = fieldDef(key);
    patchQuery(id, {
      field: key,
      operator: def.operators[0],
      value: defaultValueFor(key),
    });
  };

  const removeQuery = (id: string) => {
    setQueries((prev) => prev.filter((q) => q.id !== id));
    setView("");
    if (openPop === id) setOpenPop(null);
  };

  const clearAll = () => {
    setQueries([]);
    setSearch("");
    setView("all");
    setOpenPop(null);
  };

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    return DEALS.filter((d) => {
      if (
        term &&
        !d.name.toLowerCase().includes(term) &&
        !d.company.toLowerCase().includes(term)
      )
        return false;
      return queries.every((q) => applies(d, q));
    });
  }, [queries, search]);

  const totalValue = useMemo(
    () => results.reduce((sum, d) => sum + d.value, 0),
    [results],
  );

  const hasFilters = queries.length > 0 || search.trim() !== "";

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-[900px] w-full flex-col overflow-hidden bg-white p-6 sm:p-8 dark:bg-neutral-950"
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl tracking-[-0.015em] text-neutral-900 dark:text-white">
              Deal pipeline
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              <span className="tabular-nums">{results.length}</span> of{" "}
              <span className="tabular-nums">{DEALS.length}</span> deals
              {" · "}
              <span className="tabular-nums">{money(totalValue)}</span> weighted
            </p>
          </div>

          <div
            role="group"
            aria-label="Saved views"
            className="flex flex-wrap gap-1 rounded-[var(--rb-r-lg,10px)] bg-neutral-100 p-1 dark:bg-neutral-800/60"
          >
            {VIEWS.map((v) => {
              const on = view === v.value;
              return (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => selectView(v.value)}
                  className={cx(
                    "h-8 cursor-pointer rounded-[var(--rb-r-sm,6px)] px-2.5 text-[13px] whitespace-nowrap active:scale-[0.97]",
                    transition,
                    focus,
                    on
                      ? "bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white"
                      : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals or companies…"
              aria-label="Search deals"
              className={cx(field, "pr-9 pl-9")}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className={cx(
                  "absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white",
                  transition,
                  focus,
                )}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            className="relative"
            ref={openPop === "add" ? popRef : undefined}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openPop === "add"}
              onClick={() => setOpenPop((p) => (p === "add" ? null : "add"))}
              className={cx(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--rb-r-md,8px)] border border-dashed border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.97] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900",
                transition,
                focus,
              )}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add filter
            </button>

            {openPop === "add" && (
              <div
                role="menu"
                className="absolute top-full right-0 z-30 mt-1.5 w-52 rounded-[var(--rb-r-lg,10px)] border border-neutral-200 bg-white p-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p className="px-2.5 pt-1.5 pb-1 text-xs text-neutral-400 dark:text-neutral-500">
                  Filter by field
                </p>
                {FIELDS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="menuitem"
                    onClick={() => addFilter(f.value)}
                    className={cx(
                      "flex h-8 w-full cursor-pointer items-center gap-2 rounded-[var(--rb-r-sm,6px)] px-2.5 text-sm text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800",
                      transition,
                    )}
                  >
                    <Filter
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500"
                    />
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {queries.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {queries.map((q) => {
              const def = fieldDef(q.field);
              const isOpen = openPop === q.id;
              return (
                <div
                  key={q.id}
                  className="relative"
                  ref={isOpen ? popRef : undefined}
                >
                  <div
                    className={cx(
                      "inline-flex h-8 items-center rounded-[var(--rb-r-md,8px)] border bg-white text-[13px] dark:bg-neutral-950",
                      isOpen
                        ? "border-neutral-900 dark:border-white"
                        : "border-neutral-200 dark:border-neutral-800",
                      transition,
                    )}
                  >
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenPop((p) => (p === q.id ? null : q.id))
                      }
                      className={cx(
                        "flex h-full cursor-pointer items-center gap-1.5 rounded-l-[var(--rb-r-sm,6px)] px-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-900",
                        focus,
                        "focus-visible:outline-offset-[-2px]",
                        transition,
                      )}
                    >
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {def.label}
                      </span>
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {OPERATOR_LABELS[q.operator]}
                      </span>
                      <span className="font-medium text-neutral-900 tabular-nums dark:text-white">
                        {queryValueLabel(q)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${def.label} filter`}
                      onClick={() => removeQuery(q.id)}
                      className={cx(
                        "flex h-full w-7 shrink-0 cursor-pointer items-center justify-center rounded-r-[var(--rb-r-sm,6px)] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white",
                        focus,
                        "focus-visible:outline-offset-[-2px]",
                        transition,
                      )}
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && (
                    <div
                      role="dialog"
                      aria-label={`Edit ${def.label} filter`}
                      className="absolute top-full left-0 z-30 mt-1.5 w-64 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200 bg-white p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <div className="space-y-2">
                        <Select
                          value={q.field}
                          onChange={(v) => changeField(q.id, v as keyof Deal)}
                          options={FIELD_OPTIONS}
                          ariaLabel="Field"
                          triggerClassName="h-8"
                        />
                        <Select
                          value={q.operator}
                          onChange={(v) => patchQuery(q.id, { operator: v })}
                          options={def.operators.map((op) => ({
                            value: op,
                            label: OPERATOR_LABELS[op] ?? op,
                          }))}
                          ariaLabel="Operator"
                          triggerClassName="h-8"
                        />
                        {def.kind === "enum" ? (
                          <Select
                            value={q.value}
                            onChange={(v) => patchQuery(q.id, { value: v })}
                            options={def.options ?? []}
                            ariaLabel="Value"
                            triggerClassName="h-8"
                          />
                        ) : (
                          <input
                            type={def.kind === "number" ? "number" : "text"}
                            value={q.value}
                            onChange={(e) =>
                              patchQuery(q.id, { value: e.target.value })
                            }
                            placeholder={
                              def.kind === "number"
                                ? "Enter a number"
                                : "Enter text"
                            }
                            aria-label="Value"
                            className={cx(field, "h-8")}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={clearAll}
              className={cx(
                "h-8 cursor-pointer rounded-[var(--rb-r-sm,6px)] px-2 text-[13px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white",
                transition,
                focus,
              )}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--rb-r-2xl,14px)] border border-neutral-200 dark:border-neutral-800">
          <div
            ref={tableRef}
            onScroll={onTableScroll}
            className="min-h-0 flex-1 overflow-auto"
          >
            {results.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--rb-r-lg,10px)] border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                  <Filter
                    aria-hidden="true"
                    className="h-5 w-5 text-neutral-500 dark:text-neutral-400"
                  />
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  No deals match this query
                </p>
                <p className="mt-1 max-w-xs text-xs text-neutral-600 dark:text-neutral-400">
                  Loosen an operator or remove a filter to widen the pipeline.
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className={cx(
                      "mt-4 inline-flex h-8 cursor-pointer items-center rounded-[var(--rb-r-md,8px)] bg-neutral-100 px-3 text-[13px] font-medium text-neutral-700 hover:bg-neutral-200 active:scale-[0.97] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
                      transition,
                      focus,
                    )}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Filtered deals</caption>
                <thead>
                  <tr className="sticky top-0 z-20 bg-neutral-50 dark:bg-neutral-900/90 dark:backdrop-blur">
                    <th
                      scope="col"
                      className="h-9 min-w-[180px] px-3 text-xs font-medium text-neutral-500 first:pl-4 sm:first:pl-5"
                    >
                      Deal
                    </th>
                    <th
                      scope="col"
                      className="h-9 min-w-[140px] px-3 text-xs font-medium text-neutral-500"
                    >
                      Stage
                    </th>
                    <th
                      scope="col"
                      className="h-9 min-w-[150px] px-3 text-xs font-medium text-neutral-500"
                    >
                      Owner
                    </th>
                    <th
                      scope="col"
                      className="h-9 px-3 text-right text-xs font-medium text-neutral-500"
                    >
                      Value
                    </th>
                    <th
                      scope="col"
                      className="h-9 px-3 text-right text-xs font-medium text-neutral-500"
                    >
                      Prob.
                    </th>
                    <th
                      scope="col"
                      className="h-9 px-3 text-right text-xs font-medium text-neutral-500 last:pr-4 sm:last:pr-5"
                    >
                      Close
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {results.map((d) => {
                    const owner = OWNERS.find((o) => o.value === d.owner);
                    return (
                      <tr
                        key={d.id}
                        className="group h-11 transition-colors duration-150 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="px-3 text-[13px] text-neutral-900 first:pl-4 sm:first:pl-5 dark:text-neutral-100">
                          <span className="block truncate font-medium">
                            {d.name}
                          </span>
                          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {d.company}
                          </span>
                        </td>
                        <td className="px-3">
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-neutral-700 dark:text-neutral-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                            {stageLabel(d.stage)}
                          </span>
                        </td>
                        <td className="px-3">
                          <span className="inline-flex items-center gap-2 text-[13px] text-neutral-700 dark:text-neutral-300">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                              {owner?.initials}
                            </span>
                            <span className="truncate">{owner?.label}</span>
                          </span>
                        </td>
                        <td className="px-3 text-right text-[13px] text-neutral-900 tabular-nums dark:text-neutral-100">
                          {money(d.value)}
                        </td>
                        <td className="px-3 text-right text-[13px] text-neutral-600 tabular-nums dark:text-neutral-400">
                          {d.probability}%
                        </td>
                        <td className="px-3 text-right text-[13px] text-neutral-600 tabular-nums last:pr-4 sm:last:pr-5 dark:text-neutral-400">
                          {d.close}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 top-9 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-200 ease-out dark:from-neutral-950",
              tableEdges.start ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-200 ease-out dark:from-neutral-950",
              tableEdges.end ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      </div>
    </div>
  );
}
