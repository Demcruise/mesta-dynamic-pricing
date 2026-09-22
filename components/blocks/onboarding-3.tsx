"use client";

import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,transform] duration-150 ease-out";

const panel =
  "flex items-center gap-3 rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950";

type Task = {
  id: string;
  title: string;
  blurb: string;
  action: string;
};

const TASKS: Task[] = [
  {
    id: "profile",
    title: "Complete your profile",
    blurb: "A name and photo make review threads easier to follow.",
    action: "Edit profile",
  },
  {
    id: "workspace",
    title: "Name your workspace",
    blurb: "Appears in invitations and in everyone's sidebar.",
    action: "Rename",
  },
  {
    id: "import",
    title: "Import your first project",
    blurb: "Bring in a CSV or connect an existing tracker.",
    action: "Start import",
  },
  {
    id: "invite",
    title: "Invite two teammates",
    blurb: "Workspaces with three or more people get shared views.",
    action: "Send invites",
  },
  {
    id: "integration",
    title: "Connect your repository",
    blurb: "Link branches and pull requests to the work that opened them.",
    action: "Connect",
  },
  {
    id: "notifications",
    title: "Choose how you're notified",
    blurb: "Pick the events worth interrupting you for.",
    action: "Open settings",
  },
];

export default function Onboarding3() {
  const [done, setDone] = useState<Set<string>>(
    () => new Set(["profile", "workspace"]),
  );

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const percent = Math.round((done.size / TASKS.length) * 100);

  return (
    <div className="relative h-full min-h-[640px] w-full overflow-y-auto bg-white p-6 sm:p-8 dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="text-xl font-medium tracking-[-0.015em] text-neutral-900 dark:text-neutral-100">
          Get set up
        </h2>
        <p className="mt-1.5 text-[13px] text-neutral-600 dark:text-neutral-400">
          Six things that take about ten minutes and make everything after them
          easier.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Setup progress"
            className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
          >
            <div
              style={{ width: `${percent}%` }}
              className="h-full rounded-full bg-neutral-900 transition-[width] duration-300 ease-out motion-reduce:transition-none dark:bg-neutral-100"
            />
          </div>
          <p className="shrink-0 text-xs tabular-nums text-neutral-500">
            {done.size} of {TASKS.length} done
          </p>
        </div>

        <ul className="mt-5 flex flex-col gap-1 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {TASKS.map((task) => {
            const isDone = done.has(task.id);

            return (
              <li key={task.id} className={panel}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  onClick={() => toggle(task.id)}
                  className={cx(
                    "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border active:scale-[0.97]",
                    isDone
                      ? "border-neutral-900 bg-[var(--rb-accent,oklch(20.5%_0_0))] text-[var(--rb-accent-fg,oklch(100%_0_0))] dark:border-white dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))]"
                      : "border-neutral-300 text-transparent hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600",
                    transition,
                    focus,
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className="h-3 w-3"
                    strokeWidth={3}
                  />
                  <span className="sr-only">Mark {task.title} complete</span>
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={cx(
                      "truncate text-[13px] font-medium",
                      isDone
                        ? "text-neutral-500 line-through decoration-neutral-300 dark:decoration-neutral-700"
                        : "text-neutral-900 dark:text-neutral-100",
                    )}
                  >
                    {task.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {task.blurb}
                  </p>
                </div>

                <a
                  href="#"
                  className={cx(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--rb-r-sm,6px)] bg-neutral-100 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200 active:scale-[0.97] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
                    transition,
                    focus,
                  )}
                >
                  {task.action}
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs text-neutral-500">
          You can leave this and come back to it from the workspace menu.
        </p>
      </div>
    </div>
  );
}
