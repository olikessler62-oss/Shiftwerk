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
  formatServiceHourStaffingListLabel,
  staffingQualificationLabelsForHour,
  weekdayLabelFromIndex,
} from "@/lib/location-staffing-client";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";
import {
  SettingsEmptyState,
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
} from "./settings-list-ui";
import { useTranslations } from "@/i18n/locale-provider";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/cn";

const LIST_SCROLL_FALLBACK =
  "h-[calc(1.75rem+10rem)] min-h-[calc(1.75rem+10rem)] overflow-auto";

export type LocationAreaStaffingMatrixHandle = {
  reload: () => void;
  applyStaffing: (
    staffing: LocationAreaStaffing[],
    serviceHours?: LocationAreaServiceHour[]
  ) => void;
};

export type StaffingEditorData = {
  serviceHours: LocationAreaServiceHour[];
  qualifications: Qualification[];
  staffing: LocationAreaStaffing[];
  shiftTemplates?: AreaShiftTemplateWithBreaks[];
};

type Props = {
  locationId: string;
  area: LocationArea;
  initialEditorData?: StaffingEditorData;
  selectedServiceHourId: string | null;
  onSelectServiceHour: (serviceHourId: string | null) => void;
  onEditServiceHour?: (serviceHourId: string) => void;
  onDataLoaded?: (data: StaffingEditorData) => void;
  embedded?: boolean;
  listScrollClassName?: string;
  onLoadingChange?: (loading: boolean) => void;
};

function buildCountsFromData(
  staffing: LocationAreaStaffing[]
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const rule of staffing) {
    next[rule.service_hour_id] =
      (next[rule.service_hour_id] ?? 0) + rule.required_count;
  }
  return next;
}

function sortServiceHours(hours: LocationAreaServiceHour[]): LocationAreaServiceHour[] {
  return [...hours].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.start_time.localeCompare(b.start_time);
  });
}

export const LocationAreaStaffingMatrix = forwardRef<
  LocationAreaStaffingMatrixHandle,
  Props
>(function LocationAreaStaffingMatrix(
  {
    locationId,
    area,
    initialEditorData,
    selectedServiceHourId,
    onSelectServiceHour,
    onEditServiceHour,
    onDataLoaded,
    embedded = false,
    listScrollClassName,
    onLoadingChange,
  },
  ref
) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [serviceHours, setServiceHours] = useState<LocationAreaServiceHour[]>(
    () => initialEditorData?.serviceHours ?? []
  );
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    initialEditorData ? buildCountsFromData(initialEditorData.staffing) : {}
  );
  const [staffing, setStaffing] = useState<LocationAreaStaffing[]>(
    () => initialEditorData?.staffing ?? []
  );
  const [shiftTemplates, setShiftTemplates] = useState<
    AreaShiftTemplateWithBreaks[]
  >(() => initialEditorData?.shiftTemplates ?? []);
  const [qualifications, setQualifications] = useState<Qualification[]>(
    () => initialEditorData?.qualifications ?? []
  );
  const [loading, setLoading] = useState(!initialEditorData);
  const [hasDisplayData, setHasDisplayData] = useState(!!initialEditorData);
  const [reloadToken, setReloadToken] = useState(0);
  const skipInitialFetchRef = useRef(!!initialEditorData);
  const editorMetaRef = useRef({
    serviceHours: initialEditorData?.serviceHours ?? [],
    qualifications: initialEditorData?.qualifications ?? [],
    shiftTemplates: initialEditorData?.shiftTemplates ?? [],
  });

  useEffect(() => {
    if (!initialEditorData || reloadToken !== 0) return;
    skipInitialFetchRef.current = true;
    editorMetaRef.current = {
      serviceHours: initialEditorData.serviceHours,
      qualifications: initialEditorData.qualifications,
      shiftTemplates: initialEditorData.shiftTemplates ?? [],
    };
    setServiceHours(initialEditorData.serviceHours);
    setCounts(buildCountsFromData(initialEditorData.staffing));
    setStaffing(initialEditorData.staffing);
    setQualifications(initialEditorData.qualifications);
    setShiftTemplates(initialEditorData.shiftTemplates ?? []);
    setHasDisplayData(true);
    setLoading(false);
    setError(null);
  }, [initialEditorData, reloadToken]);

  const qualificationNameById = useMemo(
    () => new Map(qualifications.map((entry) => [entry.id, entry.name])),
    [qualifications]
  );

  const configuredServiceHours = useMemo(() => {
    return sortServiceHours(
      serviceHours.filter((hour) => (counts[hour.id] ?? 0) > 0)
    );
  }, [counts, serviceHours]);

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
        setServiceHours([]);
        setCounts({});
        setStaffing([]);
        setHasDisplayData(false);
        onDataLoaded?.({ serviceHours: [], qualifications: [], staffing: [] });
        return;
      }
      const hours = result.serviceHours ?? [];
      const qualifications = result.qualifications ?? [];
      const staffing = result.staffing ?? [];
      editorMetaRef.current = { serviceHours: hours, qualifications, shiftTemplates: editorMetaRef.current.shiftTemplates };
      setServiceHours(hours);
      setCounts(buildCountsFromData(staffing));
      setStaffing(staffing);
      setQualifications(qualifications);
      setHasDisplayData(true);
      onDataLoaded?.({ serviceHours: hours, qualifications, staffing });
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, area.id, reloadToken, onDataLoaded]);

  useEffect(() => {
    if (configuredServiceHours.length === 0) {
      if (selectedServiceHourId !== null) onSelectServiceHour(null);
      return;
    }
    if (
      !selectedServiceHourId ||
      !configuredServiceHours.some((hour) => hour.id === selectedServiceHourId)
    ) {
      onSelectServiceHour(configuredServiceHours[0]!.id);
    }
  }, [configuredServiceHours, selectedServiceHourId, onSelectServiceHour]);

  useImperativeHandle(
    ref,
    () => ({
      reload: () => {
        skipInitialFetchRef.current = false;
        setReloadToken((n) => n + 1);
      },
      applyStaffing: (
        staffing: LocationAreaStaffing[],
        serviceHours?: LocationAreaServiceHour[]
      ) => {
        if (serviceHours !== undefined) {
          editorMetaRef.current = {
            ...editorMetaRef.current,
            serviceHours,
          };
          setServiceHours(serviceHours);
        }
        setCounts(buildCountsFromData(staffing));
        setStaffing(staffing);
        setHasDisplayData(true);
        setLoading(false);
        setError(null);
        onDataLoaded?.({
          serviceHours: serviceHours ?? editorMetaRef.current.serviceHours,
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

  if (configuredServiceHours.length === 0) {
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
          embedded
            ? cn("min-h-0 flex-1 border-0 bg-transparent", listScrollClassName)
            : cn(
                settingsScrollableTableListClass("rounded-md border-0"),
                listScrollClassName ?? LIST_SCROLL_FALLBACK
              )
        )}
      >
        <table className="w-full min-w-[320px] border-collapse table-fixed">
          <thead>
            <tr className="border-b border-border">
              <th
                className={settingsStickyIndicatorHeaderClass()}
                aria-hidden
              />
              <th
                className={cn(
                  settingsStickyColumnHeaderClass(),
                  "sticky left-0 z-[2] w-[42%] min-w-[160px]"
                )}
              >
                {t("locations.staffingServiceWindow")}
              </th>
              <th
                className={cn(
                  settingsStickyColumnHeaderClass(),
                  "w-[58%]"
                )}
              >
                {t("locations.staffingQualificationsSection")}
              </th>
            </tr>
          </thead>
          <tbody>
            {configuredServiceHours.map((hour) => {
              const isSelected = hour.id === selectedServiceHourId;
              const label = formatServiceHourStaffingListLabel(
                hour,
                (weekday) => weekdayLabelFromIndex(weekday, t),
                shiftTemplates
              );
              const qualificationLabels = staffingQualificationLabelsForHour(
                hour.id,
                staffing,
                qualificationNameById
              );
              const qualificationsText = qualificationLabels.join(", ");
              return (
                <tr
                  key={hour.id}
                  {...settingsListItemAttrs(hour.id)}
                  onClick={() => onSelectServiceHour(hour.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    window.getSelection()?.removeAllRanges();
                    onSelectServiceHour(hour.id);
                    onEditServiceHour?.(hour.id);
                  }}
                  className={settingsDataRowClass(isSelected)}
                >
                  <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                  <td
                    className={cn(
                      settingsDataCellClass(isSelected, {
                        className:
                          "sticky left-0 z-10 min-w-[160px] bg-background font-medium",
                      })
                    )}
                  >
                    {label}
                  </td>
                  <td className={settingsDataCellClass(isSelected, { className: "max-w-0" })}>
                    {qualificationsText ? (
                      <span
                        className="block truncate"
                        title={qualificationsText}
                      >
                        {qualificationsText}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
