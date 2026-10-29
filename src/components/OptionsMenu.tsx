import { useEffect, useId, useRef, useState } from "react";
import { Settings } from "lucide-react";
import type { AllocationBounds, DayWindow } from "../types";
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  formatHourOption,
} from "../lib/time";

const HOUR_OPTIONS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
  (_, i) => GRID_START_HOUR + i,
);

function clampWindow(win: DayWindow): DayWindow {
  let startHour = Math.min(Math.max(win.startHour, GRID_START_HOUR), GRID_END_HOUR - 1);
  let endHour = Math.min(Math.max(win.endHour, startHour + 1), GRID_END_HOUR);
  return { startHour, endHour };
}

function WindowEditors({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: DayWindow;
  onChange: (next: DayWindow) => void;
}) {
  const startId = useId();
  const endId = useId();

  return (
    <fieldset className="space-y-2 rounded-xl border border-teal-900/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
      <legend className="px-1 text-sm font-semibold text-teal-950 dark:text-teal-50">
        {label}
      </legend>
      <p className="text-[11px] text-teal-900/55 dark:text-teal-100/55">{hint}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs" htmlFor={startId}>
          <span className="font-medium text-teal-900/70 dark:text-teal-100/70">From</span>
          <select
            id={startId}
            className="mt-1 w-full rounded-lg border border-teal-900/15 bg-white px-2 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
            value={value.startHour}
            onChange={(e) =>
              onChange(
                clampWindow({
                  startHour: Number(e.target.value),
                  endHour: value.endHour,
                }),
              )
            }
          >
            {HOUR_OPTIONS.filter((h) => h < GRID_END_HOUR).map((h) => (
              <option key={h} value={h} disabled={h >= value.endHour}>
                {formatHourOption(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs" htmlFor={endId}>
          <span className="font-medium text-teal-900/70 dark:text-teal-100/70">To</span>
          <select
            id={endId}
            className="mt-1 w-full rounded-lg border border-teal-900/15 bg-white px-2 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
            value={value.endHour}
            onChange={(e) =>
              onChange(
                clampWindow({
                  startHour: value.startHour,
                  endHour: Number(e.target.value),
                }),
              )
            }
          >
            {HOUR_OPTIONS.filter((h) => h > GRID_START_HOUR).map((h) => (
              <option key={h} value={h} disabled={h <= value.startHour}>
                {formatHourOption(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

interface Props {
  bounds: AllocationBounds;
  onChange: (next: AllocationBounds) => void;
}

export function OptionsMenu({ bounds, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white/80 px-3 py-2 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Settings className="size-4" />
        Options
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[100] mt-2 w-[min(100vw-2rem,20rem)] rounded-2xl border border-teal-900/10 bg-[#f7faf6] p-3 shadow-xl dark:border-white/10 dark:bg-[#12201a]"
        >
          <h3 className="mb-1 font-display text-base text-teal-950 dark:text-teal-50">
            Allocation hours
          </h3>
          <p className="mb-3 text-[11px] leading-snug text-teal-900/55 dark:text-teal-100/55">
            Free-slot highlight and auto-scheduler only place work inside these windows.
          </p>
          <div className="space-y-3">
            <WindowEditors
              label="Work week"
              hint="Monday – Friday"
              value={bounds.workweek}
              onChange={(workweek) => onChange({ ...bounds, workweek })}
            />
            <WindowEditors
              label="Weekend"
              hint="Saturday – Sunday"
              value={bounds.weekend}
              onChange={(weekend) => onChange({ ...bounds, weekend })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
