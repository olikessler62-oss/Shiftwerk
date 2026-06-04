import { formatDayHeader, formatTimeRange } from "@/lib/planning-utils";

/** Bereiche wie in der Skizze — Zuordnung zu Schichten folgt später */
export const DASHBOARD_AREAS = ["Restaurant", "BAR", "Küche"] as const;

export type DashboardArea = (typeof DASHBOARD_AREAS)[number];

export type DashboardShiftCard = {
  id: string;
  shift_date: string;
  area: DashboardArea;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
  employeeName: string;
};

type Props = {
  dates: string[];
  orgName: string;
  shifts: DashboardShiftCard[];
};

export function DashboardCalendar({ dates, orgName, shifts }: Props) {
  const byAreaDate = new Map<string, DashboardShiftCard[]>();
  for (const shift of shifts) {
    const key = `${shift.area}:${shift.shift_date}`;
    const list = byAreaDate.get(key) ?? [];
    list.push(shift);
    byAreaDate.set(key, list);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-background">
            <th className="sticky left-0 z-20 min-w-[180px] border-r border-border bg-background px-4 py-3 text-left align-bottom">
              <p className="text-xs font-medium text-muted">Standort</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{orgName}</p>
            </th>
            {dates.map((date) => {
              const { weekday, label } = formatDayHeader(date);
              return (
                <th key={date} className="min-w-[120px] px-2 py-3 text-center align-bottom">
                  <div className="text-xs font-semibold text-muted">{weekday}</div>
                  <div className="text-sm font-medium">{label}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {DASHBOARD_AREAS.map((area) => (
            <tr key={area} className="border-b border-border last:border-0">
              <td className="sticky left-0 z-10 border-r border-border bg-surface px-4 py-3 align-top font-semibold">
                {area}
              </td>
              {dates.map((date) => {
                const dayShifts = byAreaDate.get(`${area}:${date}`) ?? [];
                return (
                  <td key={date} className="min-h-[120px] align-top p-2">
                    <div className="flex min-h-[100px] flex-col gap-1.5">
                      {dayShifts.length === 0 ? (
                        <span className="block min-h-[100px] rounded-lg border border-dashed border-transparent" />
                      ) : (
                        dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="rounded-lg px-2.5 py-2 text-white shadow-sm"
                            style={{ backgroundColor: shift.color }}
                          >
                            <p className="text-xs font-semibold leading-tight">
                              {shift.shiftName}{" "}
                              {formatTimeRange(shift.startTime, shift.endTime)}
                            </p>
                            <p className="mt-1 text-xs leading-tight opacity-95">
                              {shift.employeeName}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
