"use client";

import { useSimpleCalendarDisplay } from "@/lib/simple-calendar-display-context";

/** Temporär: Simple- vs. Advanced-Kalenderdarstellung (Dashboard + Schichtplan). */
export function SimpleCalendarDisplaySidebarToggle() {
  const { simpleCalendarFirstShiftOnly, setSimpleCalendarFirstShiftOnly } =
    useSimpleCalendarDisplay();

  return (
    <div className="mx-2 mb-3 mt-2 border-t border-dashed border-amber-400/70 pt-3">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        Temp
      </p>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-left text-xs text-foreground hover:bg-primary/5">
        <input
          type="checkbox"
          className="mt-0.5 shrink-0"
          checked={simpleCalendarFirstShiftOnly}
          onChange={(event) =>
            setSimpleCalendarFirstShiftOnly(event.target.checked)
          }
        />
        <span>
          <span className="font-medium">Simple-Kalender</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">
            Nur erste Schicht pro Mitarbeiter und Tag
          </span>
        </span>
      </label>
    </div>
  );
}
