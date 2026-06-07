"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchLocationStaffingEditor } from "@/app/actions/location-staffing";
import {
  isStaffingDayEnabled,
  STAFFING_HOLIDAY_WEEKDAY,
} from "@/lib/location-staffing-client";
import type {
  LocationArea,
  LocationAreaStaffing,
  Qualification,
  ShiftType,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import {
  SettingsEmptyState,
  settingsColumnHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
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
  applyStaffing: (staffing: LocationAreaStaffing[]) => void;
};

export type StaffingEditorData = {
  shiftTypes: ShiftType[];
  qualifications: Qualification[];
  staffing: LocationAreaStaffing[];
};

type Props = {
  locationId: string;
  area: LocationArea;
  serviceHours: AreaServiceHourRef[];
  initialEditorData?: StaffingEditorData;
  selectedShiftTypeId: string | null;
  onSelectShiftType: (shiftTypeId: string | null) => void;
  onEditShiftType?: (shiftTypeId: string) => void;
  onDataLoaded?: (data: StaffingEditorData) => void;
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
    const key = staffingKey(rule.shift_type_id, rule.weekday);
    next[key] = (next[key] ?? 0) + rule.required_count;
  }
  return next;
}

export const LocationAreaStaffingMatrix = forwardRef<
  LocationAreaStaffingMatrixHandle,
  Props
>(function LocationAreaStaffingMatrix(
  {
    locationId,
    area,
    serviceHours,
    initialEditorData,
    selectedShiftTypeId,
    onSelectShiftType,
    onEditShiftType,
    onDataLoaded,
    embedded = false,
    listScrollClassName,
    onLoadingChange,
  },
  ref
) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(
    () => initialEditorData?.shiftTypes ?? []
  );
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    initialEditorData ? buildCountsFromData(initialEditorData.staffing) : {}
  );
  const [loading, setLoading] = useState(!initialEditorData);
  const [hasDisplayData, setHasDisplayData] = useState(!!initialEditorData);
  const [reloadToken, setReloadToken] = useState(0);
  const skipInitialFetchRef = useRef(!!initialEditorData);
  const editorMetaRef = useRef({
    shiftTypes: initialEditorData?.shiftTypes ?? [],
    qualifications: initialEditorData?.qualifications ?? [],
  });

  useEffect(() => {
    if (!initialEditorData || reloadToken !== 0) return;
    skipInitialFetchRef.current = true;
    editorMetaRef.current = {
      shiftTypes: initialEditorData.shiftTypes,
      qualifications: initialEditorData.qualifications,
    };
    setShiftTypes(initialEditorData.shiftTypes);
    setCounts(buildCountsFromData(initialEditorData.staffing));
    setHasDisplayData(true);
    setLoading(false);
    setError(null);
  }, [initialEditorData, reloadToken]);

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
    if (skipInitialFetchRef.current && reloadToken === 0) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchLocationStaffingEditor(locationId, area.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        setShiftTypes([]);
        setCounts({});
        setHasDisplayData(false);
        onDataLoaded?.({ shiftTypes: [], qualifications: [], staffing: [] });
        return;
      }
      const types = result.shiftTypes ?? [];
      const qualifications = result.qualifications ?? [];
      const staffing = result.staffing ?? [];
      editorMetaRef.current = { shiftTypes: types, qualifications };
      setShiftTypes(types);
      setCounts(buildCountsFromData(staffing));
      setHasDisplayData(true);
      onDataLoaded?.({ shiftTypes: types, qualifications, staffing });
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, area.id, reloadToken, onDataLoaded]);

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
      reload: () => {
        skipInitialFetchRef.current = false;
        setReloadToken((n) => n + 1);
      },
      applyStaffing: (staffing: LocationAreaStaffing[]) => {
        setCounts(buildCountsFromData(staffing));
        setHasDisplayData(true);
        setLoading(false);
        setError(null);
        onDataLoaded?.({
          shiftTypes: editorMetaRef.current.shiftTypes,
          qualifications: editorMetaRef.current.qualifications,
          staffing,
        });
      },
    }),
    [onDataLoaded]
  );

  if (loading && !hasDisplayData) {
    return (
      <SettingsEmptyState
        message={t("common.loading")}
        className={embedded ? "min-h-full" : undefined}
      />
    );
  }

  if (shiftTypes.length === 0) {
    return (
      <SettingsEmptyState
        message={t("locations.staffingNoShiftTypes")}
        className={embedded ? "min-h-full" : undefined}
      />
    );
  }

  if (configuredShiftTypes.length === 0) {
    return (
      <SettingsEmptyState
        message={t("locations.staffingEmpty")}
        hint={t("common.emptyHintCreate")}
        className={embedded ? "min-h-full" : undefined}
      />
    );
  }

  return (
    <div
      aria-busy={loading}
      className={cn(
        embedded ? "flex min-h-full flex-col" : "border-t border-border bg-background/50 px-4 py-3",
        loading && hasDisplayData && "pointer-events-none opacity-60"
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
                const open = isStaffingDayEnabled(serviceHours, area.id, weekday);
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
                  !isStaffingDayEnabled(
                    serviceHours,
                    area.id,
                    STAFFING_HOLIDAY_WEEKDAY
                  ) &&
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
                  {...settingsListItemAttrs(type.id)}
                  onClick={() => onSelectShiftType(type.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    window.getSelection()?.removeAllRanges();
                    onSelectShiftType(type.id);
                    onEditShiftType?.(type.id);
                  }}
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
                    const open = isStaffingDayEnabled(serviceHours, area.id, weekday);
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
                    const open = isStaffingDayEnabled(serviceHours, area.id, weekday);
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
