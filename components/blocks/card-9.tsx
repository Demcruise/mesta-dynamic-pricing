"use client";

import { useState } from "react";
import { BadgeCheck, MapPin } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const focus =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";

const transition =
  "transition-[background-color,border-color,color,transform] duration-150 ease-out";

const outlineButton =
  "inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900";

const panel =
  "rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-950";

const STATS = [
  { label: "Projects", value: "24" },
  { label: "Reviews", value: "318" },
  { label: "Following", value: "1.2k" },
];

const SKILLS = ["Design systems", "Prototyping", "Accessibility"];

export default function Card9() {
  const [following, setFollowing] = useState(false);

  return (
    <div className="relative flex h-full min-h-[480px] w-full items-center justify-center overflow-hidden bg-white p-8 sm:p-10 dark:bg-neutral-950">
      <article className="grid w-full max-w-[380px] grid-cols-3 gap-1 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
        <div className={cx(panel, "col-span-3 p-5")}>
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[13px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >
              SR
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-1 text-base font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
                <span className="min-w-0 truncate">Sam Rivera</span>
                <BadgeCheck
                  aria-label="Verified account"
                  className="h-4 w-4 shrink-0 text-neutral-400"
                />
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-neutral-600 dark:text-neutral-400">
                Product designer at Meridian
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                Lisbon, Portugal
              </p>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Works on the payments surface. Currently rewriting the checkout flow
            and writing about it as it happens.
          </p>

          <ul className="mt-4 flex flex-wrap gap-1.5">
            {SKILLS.map((skill) => (
              <li
                key={skill}
                className="inline-flex h-5 items-center rounded-[var(--rb-r-sm,6px)] bg-neutral-100 px-1.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
              >
                {skill}
              </li>
            ))}
          </ul>
        </div>

        {STATS.map((stat) => (
          <div key={stat.label} className={cx(panel, "px-3 py-3 text-center")}>
            <p className="text-base font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {stat.value}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-neutral-500">
              {stat.label}
            </p>
          </div>
        ))}

        <div className={cx(panel, "col-span-3 p-3")}>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-pressed={following}
              onClick={() => setFollowing((v) => !v)}
              className={cx(
                outlineButton,
                "col-span-2",
                following &&
                  "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
                transition,
                focus,
              )}
            >
              {following ? "Following" : "Follow"}
              <span className="sr-only"> Sam Rivera</span>
            </button>

            <a href="#" className={cx(outlineButton, transition, focus)}>
              Message
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}
