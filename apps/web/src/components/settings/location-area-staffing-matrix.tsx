"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  fetchLocationStaffingEditor,
  saveLocationAreaStaffing,
} from "@/app/actions/location-staffing";
import { isLocationOpenOnWeekday } from "@/lib/location-staffing-client";
import type { Location, LocationArea, ShiftType } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/cn";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type LocationAreaStaffingMatrixHandle = {
  save: () => Promise<boolean>;
  reload: () => void;
  clear: () => Promise<boolean>;
};

type Props = {
  location: Location;
  area: LocationArea;
  disabled?: boolean;
  embedded?: boolean;
  listScrollClassName?: string;
};

function staffingKey(shiftTypeId: string, weekday: number) {
  return `${shiftTypeId}:${weekday}`;
}

function buildCountsFromData(
  types: ShiftType[],
  staffing: { shift_type_id: string; weekday: number; required_count: number }[]
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const rule of staffing) {
    next[staffingKey(rule.shift_type_id, rule.weekday)] = rule.required_count;
  }
  for (const type of types) {
    for (let wd = 0; wd < 7; wd++) {
      const key = staffingKey(type.id, wd);
      if (next[key] === undefined) next[key] = 0;
    }
  }
  return next;
}

export const LocationAreaStaffingMatrix = forwardRef<
  LocationAreaStaffingMatrixHandle,
  Props
>(function LocationAreaStaffingMatrix(
  { location, area, disabled, embedded = false, listScrollClassName },
  ref
) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const rulesPayload = useMemo(() => {
    const rules: {
      shift_type_id: string;
      weekday: number;
      required_count: number;
    }[] = [];
    for (const type of shiftTypes) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const required_count = counts[staffingKey(type.id, weekday)] ?? 0;
        rules.push({ shift_type_id: type.id, weekday, required_count });
      }
    }
    return rules;
  }, [counts, shiftTypes]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchLocationStaffingEditor(location.id, area.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        setShiftTypes([]);
        setCounts({});
        return;
      }
      const types = result.shiftTypes ?? [];
      setShiftTypes(types);
      setCounts(buildCountsFromData(types, result.staffing ?? []));
    });
    return () => {
      cancelled = true;
    };
  }, [location.id, area.id, reloadToken]);

  function setCount(shiftTypeId: string, weekday: number, value: number) {
    const n = Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0));
    setCounts((prev) => ({ ...prev, [staffingKey(shiftTypeId, weekday)]: n }));
  }

  function persistRules(
    rules: { shift_type_id: string; weekday: number; required_count: number }[]
  ): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await saveLocationAreaStaffing({
          locationId: location.id,
          locationAreaId: area.id,
          rules,
        });
        if (!result.ok) {
          setError(result.error);
          resolve(false);
          return;
        }
        setError(null);
        const types = shiftTypes;
        setCounts(buildCountsFromData(types, result.staffing ?? []));
        resolve(true);
      });
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      save: () => persistRules(rulesPayload),
      reload: () => setReloadToken((n) => n + 1),
      clear: () => {
        const zeroRules = shiftTypes.flatMap((type) =>
          Array.from({ length: 7 }, (_, weekday) => ({
            shift_type_id: type.id,
            weekday,
            required_count: 0,
          }))
        );
        setCounts(
          buildCountsFromData(
            shiftTypes,
            zeroRules.map((r) => ({
              shift_type_id: r.shift_type_id,
              weekday: r.weekday,
              required_count: 0,
            }))
          )
        );
        return persistRules(zeroRules);
      },
    }),
    [rulesPayload, shiftTypes, location.id, area.id]
  );

  if (loading) {
    return (
      <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-sm text-muted">
        {t("common.loading")}
      </p>
    );
  }

  if (shiftTypes.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center px-2 py-6 text-center text-sm text-muted">
        {t("locations.staffingNoShiftTypes")}
      </p>
    );
  }

  const scrollClass =
    listScrollClassName ??
    "max-h-[min(calc(1.75rem+12rem),calc(100dvh-18rem))] overflow-y-auto";

  return (
    <div
      className={cn(
        embedded ? "flex flex-col" : "border-t border-border bg-background/50 px-4 py-3"
      )}
    >
      {error && (
        <Alert variant="error" className="mb-2 shrink-0 text-xs">
          {error}
        </Alert>
      )}
      <div
        className={cn(
          "overflow-x-auto rounded-md border-0",
          embedded && "border-0 bg-transparent",
          scrollClass
        )}
      >
        <table className="w-full min-w-[360px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-subtle">
              <th className="sticky left-0 z-10 min-w-[122px] bg-background px-1.5 py-1.5 text-left font-semibold text-muted">
                {t("locations.staffingShiftType")}
              </th>
              {WEEKDAY_KEYS.map((key, weekday) => {
                const open = isLocationOpenOnWeekday(
                  location.active_weekdays,
                  weekday
                );
                return (
                  <th
                    key={key}
                    className={cn(
                      "min-w-[36px] px-0.5 py-1.5 text-center font-semibold",
                      open ? "text-muted" : "text-muted/40"
                    )}
                  >
                    {t(`locations.weekdays.${key}`).slice(0, 2)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shiftTypes.map((type) => (
              <tr key={type.id} className="h-8 border-b border-border last:border-0">
                <td className="sticky left-0 z-10 h-8 min-w-[122px] whitespace-nowrap bg-background px-1.5 py-0">
                  <span
                    className="mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="font-medium">{type.name}</span>
                </td>
                {WEEKDAY_KEYS.map((_, weekday) => {
                  const open = isLocationOpenOnWeekday(
                    location.active_weekdays,
                    weekday
                  );
                  const key = staffingKey(type.id, weekday);
                  return (
                    <td key={weekday} className="h-8 px-0.5 py-0 text-center">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        disabled={disabled || pending || !open}
                        value={counts[key] ?? 0}
                        onChange={(e) =>
                          setCount(type.id, weekday, parseInt(e.target.value, 10))
                        }
                        className={cn(
                          "h-6 w-9 rounded-[var(--radius-control)] border border-border bg-surface text-center tabular-nums",
                          !open && "cursor-not-allowed opacity-40"
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!embedded && (
        <p className="mt-2 shrink-0 text-xs text-muted">{t("locations.staffingHint")}</p>
      )}
    </div>
  );
});
