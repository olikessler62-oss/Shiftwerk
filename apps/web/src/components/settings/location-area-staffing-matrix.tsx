"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { fetchLocationStaffingEditor } from "@/app/actions/location-staffing";
import {
  isStaffingDayEnabled,
  STAFFING_HOLIDAY_WEEKDAY,
} from "@/lib/location-staffing-client";
import type { Location, LocationArea, LocationAreaStaffing, ShiftType } from "@schichtwerk/types";
import {
  SettingsEmptyState,
  settingsColumnHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
} from "./settings-list-ui";
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

const LIST_SCROLL_FALLBACK =
  "h-[calc(1.75rem+10rem)] min-h-[calc(1.75rem+10rem)] overflow-y-auto";

export type LocationAreaStaffingMatrixHandle = {
  reload: () => void;
};

type Props = {
  location: Location;
  area: LocationArea;
  selectedShiftTypeId: string | null;
  onSelectShiftType: (shiftTypeId: string | null) => void;
  onDataLoaded?: (data: {
    shiftTypes: ShiftType[];
    staffing: LocationAreaStaffing[];
  }) => void;
  embedded?: boolean;
  listScrollClassName?: string;
  onLoadingChange?: (loading: boolean) => void;
};

function staffingKey(shiftTypeId: string, weekday: number) {
  return `${shiftTypeId}:${weekday}`;
}

function buildCountsFromData(
  staffing: { shift_type_id: string; weekday: number; required_count: number }[]
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const rule of staffing) {
    next[staffingKey(rule.shift_type_id, rule.weekday)] = rule.required_count;
  }
  return next;
}

export const LocationAreaStaffingMatrix = forwardRef<
  LocationAreaStaffingMatrixHandle,
  Props
>(function LocationAreaStaffingMatrix(
  {
    location,
    area,
    selectedShiftTypeId,
    onSelectShiftType,
    onDataLoaded,
    embedded = false,
    listScrollClassName,
    onLoadingChange,
  },
  ref
) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const configuredShiftTypes = useMemo(() => {
    const ids = new Set<string>();
    for (const [key, count] of Object.entries(counts)) {
      if (count > 0) ids.add(key.split(":")[0]!);
    }
    return shiftTypes.filter((type) => ids.has(type.id));
  }, [counts, shiftTypes]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    return () => {
      onLoadingChange?.(false);
    };
  }, [onLoadingChange]);

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
        onDataLoaded?.({ shiftTypes: [], staffing: [] });
        return;
      }
      const types = result.shiftTypes ?? [];
      const staffing = result.staffing ?? [];
      setShiftTypes(types);
      setCounts(buildCountsFromData(staffing));
      onDataLoaded?.({ shiftTypes: types, staffing });
    });
    return () => {
      cancelled = true;
    };
  }, [location.id, area.id, reloadToken, onDataLoaded]);

  useEffect(() => {
    if (configuredShiftTypes.length === 0) {
      if (selectedShiftTypeId !== null) onSelectShiftType(null);
      return;
    }
    if (
      !selectedShiftTypeId ||
      !configuredShiftTypes.some((type) => type.id === selectedShiftTypeId)
    ) {
      onSelectShiftType(configuredShiftTypes[0]!.id);
    }
  }, [configuredShiftTypes, selectedShiftTypeId, onSelectShiftType]);

  useImperativeHandle(
    ref,
    () => ({
      reload: () => setReloadToken((n) => n + 1),
    }),
    []
  );

  if (loading) {
    return (
      <SettingsEmptyState
        message={t("common.loading")}
        className={embedded ? "min-h-[calc(2rem+11rem)]" : undefined}
      />
    );
  }

  if (shiftTypes.length === 0) {
    return (
      <SettingsEmptyState
        message={t("locations.staffingNoShiftTypes")}
        className={embedded ? "min-h-[calc(2rem+11rem)]" : undefined}
      />
    );
  }

  if (configuredShiftTypes.length === 0) {
    return (
      <SettingsEmptyState
        message={t("locations.staffingEmpty")}
        hint={t("common.emptyHintCreate")}
        className={embedded ? "min-h-[calc(2rem+11rem)]" : undefined}
      />
    );
  }

  return (
    <div
      className={cn(
        embedded ? "flex min-h-full flex-col" : "border-t border-border bg-background/50 px-4 py-3"
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
          embedded
            ? "min-h-0 flex-1 border-0 bg-transparent"
            : listScrollClassName ?? LIST_SCROLL_FALLBACK
        )}
      >
        <table className="w-full min-w-[360px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-subtle">
              <th className="w-1 p-0" aria-hidden />
              <th className={cn(settingsColumnHeaderClass(), "sticky left-0 z-10 min-w-[122px] bg-background")}>
                {t("locations.staffingShiftType")}
              </th>
              {WEEKDAY_KEYS.map((key, weekday) => {
                const open = isStaffingDayEnabled(location, weekday);
                return (
                  <th
                    key={key}
                    className={cn(
                      settingsColumnHeaderClass("center"),
                      "min-w-[36px]",
                      !open && "text-muted/40"
                    )}
                  >
                    {t(`locations.weekdays.${key}`).slice(0, 2)}
                  </th>
                );
              })}
              <th
                className={cn(
                  settingsColumnHeaderClass("center"),
                  "min-w-[36px]",
                  !isStaffingDayEnabled(location, STAFFING_HOLIDAY_WEEKDAY) &&
                    "text-muted/40"
                )}
              >
                {t("locations.weekdays.holiday").slice(0, 2)}
              </th>
            </tr>
          </thead>
          <tbody>
            {configuredShiftTypes.map((type) => {
              const isSelected = type.id === selectedShiftTypeId;
              return (
                <tr
                  key={type.id}
                  onClick={() => onSelectShiftType(type.id)}
                  className={settingsDataRowClass(isSelected)}
                >
                  <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                  <td className={cn(settingsDataCellClass(isSelected, { className: "sticky left-0 z-10 min-w-[122px] bg-background font-medium" }))}>
                    <span
                      className="mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                      style={{ backgroundColor: type.color }}
                    />
                    {type.name}
                  </td>
                  {WEEKDAY_KEYS.map((_, weekday) => {
                    const open = isStaffingDayEnabled(location, weekday);
                    const count = counts[staffingKey(type.id, weekday)] ?? 0;
                    return (
                      <td
                        key={weekday}
                        className={cn(
                          settingsDataCellClass(isSelected, { align: "center" }),
                          !open && "text-muted/40"
                        )}
                      >
                        {count > 0 ? count : "—"}
                      </td>
                    );
                  })}
                  {(() => {
                    const weekday = STAFFING_HOLIDAY_WEEKDAY;
                    const open = isStaffingDayEnabled(location, weekday);
                    const count = counts[staffingKey(type.id, weekday)] ?? 0;
                    return (
                      <td
                        className={cn(
                          settingsDataCellClass(isSelected, { align: "center" }),
                          !open && "text-muted/40"
                        )}
                      >
                        {count > 0 ? count : "—"}
                      </td>
                    );
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
