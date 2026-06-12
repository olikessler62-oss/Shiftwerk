"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { fetchLocationStaffingEditor } from "@/app/actions/location-staffing";
import {
  formatServiceHourStaffingDayLabel,
  formatServiceHourStaffingTimeLabel,
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
  SettingsListRowDeleteButton,
  SETTINGS_LIST_SCROLL_COMPACT_CLASS,
  settingsScrollableTableListClass,
  settingsListRowDeleteCellClass,
  settingsColumnHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
} from "./settings-list-ui";
import { useTranslations } from "@/i18n/locale-provider";
import { Alert } from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

const LIST_SCROLL_FALLBACK = SETTINGS_LIST_SCROLL_COMPACT_CLASS;

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
  onDeleteServiceHour?: (serviceHourId: string) => void;
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

const STAFFING_MATRIX_HEADER_CLASS = "py-0 pb-0";
const STAFFING_MATRIX_EMBEDDED_ROW_CLASS = "[&_td]:py-0 [&_td]:leading-none";
const STAFFING_MATRIX_HEAD_STICKY_CLASS =
  "sticky top-0 z-20 bg-subtle shadow-[inset_0_-1px_0_0_hsl(var(--border))]";
const STAFFING_MATRIX_HEAD_INDICATOR_CLASS =
  "sticky left-0 top-0 z-[30] border-l-4 border-l-transparent bg-subtle shadow-[inset_0_-1px_0_0_hsl(var(--border))]";
const STAFFING_MATRIX_HEAD_DAY_CLASS =
  "sticky top-0 z-[26] bg-subtle shadow-[inset_0_-1px_0_0_hsl(var(--border))]";
const STAFFING_MATRIX_HEAD_DAY_STICKY_LEFT_CLASS = "sticky left-0";
const STAFFING_MATRIX_DAY_COLUMN_CLASS = "w-[6.25rem] min-w-[6.25rem] max-w-[6.25rem]";
const STAFFING_MATRIX_TIME_COLUMN_CLASS =
  "w-[calc(3.375rem+150px)] min-w-[calc(3.375rem+150px)] max-w-[calc(3.375rem+150px)]";
const STAFFING_MATRIX_BODY_DAY_CLASS =
  `relative z-0 ${STAFFING_MATRIX_DAY_COLUMN_CLASS} bg-background font-medium`;
const STAFFING_MATRIX_BODY_TIME_COLUMN_CLASS =
  `relative z-0 ${STAFFING_MATRIX_TIME_COLUMN_CLASS} tabular-nums`;
const STAFFING_MATRIX_BODY_DAY_STICKY_LEFT_CLASS = "sticky left-0 z-[5]";
const STAFFING_MATRIX_BODY_INDICATOR_CLASS = "relative z-0";

function staffingMatrixEmbeddedCellClass(className?: string) {
  return cn(
    "min-h-0 max-h-[25px] px-2 py-0 text-left text-sm leading-none tabular-nums text-foreground",
    className
  );
}

function staffingMatrixEmbeddedDayCellClass(
  isSelected: boolean,
  className?: string
) {
  return cn(
    staffingMatrixEmbeddedCellClass(className),
    isSelected ? "border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
  );
}

function staffingMatrixDataCellClass(
  isSelected: boolean,
  embedded: boolean,
  className?: string
) {
  if (embedded) {
    return staffingMatrixEmbeddedCellClass(className);
  }
  return settingsDataCellClass(isSelected, {
    className: cn(className),
  });
}

function applyStaffingEditorData(
  data: StaffingEditorData,
  setters: {
    setServiceHours: (hours: LocationAreaServiceHour[]) => void;
    setCounts: (counts: Record<string, number>) => void;
    setStaffing: (staffing: LocationAreaStaffing[]) => void;
    setQualifications: (qualifications: Qualification[]) => void;
    setShiftTemplates: (templates: AreaShiftTemplateWithBreaks[]) => void;
    setHasDisplayData: (value: boolean) => void;
    setLoading: (value: boolean) => void;
    setError: (value: string | null) => void;
  },
  editorMetaRef: RefObject<{
    serviceHours: LocationAreaServiceHour[];
    qualifications: Qualification[];
    shiftTemplates: AreaShiftTemplateWithBreaks[];
  }>
) {
  editorMetaRef.current = {
    serviceHours: data.serviceHours,
    qualifications: data.qualifications,
    shiftTemplates: data.shiftTemplates ?? [],
  };
  setters.setServiceHours(data.serviceHours);
  setters.setCounts(buildCountsFromData(data.staffing));
  setters.setStaffing(data.staffing);
  setters.setQualifications(data.qualifications);
  setters.setShiftTemplates(data.shiftTemplates ?? []);
  setters.setHasDisplayData(true);
  setters.setLoading(false);
  setters.setError(null);
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
    onDeleteServiceHour,
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

  useLayoutEffect(() => {
    if (!initialEditorData) return;
    skipInitialFetchRef.current = true;
    applyStaffingEditorData(
      initialEditorData,
      {
        setServiceHours,
        setCounts,
        setStaffing,
        setQualifications,
        setShiftTemplates,
        setHasDisplayData,
        setLoading,
        setError,
      },
      editorMetaRef
    );
  }, [initialEditorData]);

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
          shiftTemplates: editorMetaRef.current.shiftTemplates,
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

  if (configuredServiceHours.length === 0 && !(loading && hasDisplayData)) {
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
        <table className="w-full min-w-0 table-fixed border-separate border-spacing-0">
          <colgroup>
            {!embedded ? <col className="w-1" /> : null}
            <col className={STAFFING_MATRIX_DAY_COLUMN_CLASS} />
            <col className={STAFFING_MATRIX_TIME_COLUMN_CLASS} />
            <col />
            <col className="w-10" />
          </colgroup>
          <thead className="relative z-20">
            <tr className="border-b border-border">
              {!embedded ? (
                <th
                  className={cn(STAFFING_MATRIX_HEAD_INDICATOR_CLASS, "w-1 p-0")}
                  aria-hidden
                />
              ) : null}
              <th
                className={cn(
                  settingsColumnHeaderClass(),
                  STAFFING_MATRIX_HEAD_DAY_CLASS,
                  !embedded && STAFFING_MATRIX_HEAD_DAY_STICKY_LEFT_CLASS,
                  STAFFING_MATRIX_DAY_COLUMN_CLASS,
                  embedded && STAFFING_MATRIX_HEADER_CLASS
                )}
              >
                {t("locations.serviceHoursColumnDay")}
              </th>
              <th
                className={cn(
                  settingsColumnHeaderClass(),
                  STAFFING_MATRIX_HEAD_STICKY_CLASS,
                  STAFFING_MATRIX_TIME_COLUMN_CLASS,
                  embedded && STAFFING_MATRIX_HEADER_CLASS
                )}
              >
                {t("locations.staffingColumnTime")}
              </th>
              <th
                className={cn(
                  settingsColumnHeaderClass(),
                  STAFFING_MATRIX_HEAD_STICKY_CLASS,
                  "min-w-0",
                  embedded && STAFFING_MATRIX_HEADER_CLASS
                )}
              >
                {t("locations.staffingQualificationsSection")}
              </th>
              <th
                className={cn(
                  settingsColumnHeaderClass("center"),
                  STAFFING_MATRIX_HEAD_STICKY_CLASS,
                  "w-10 px-0 py-1 pb-1 pr-2.5",
                  embedded && STAFFING_MATRIX_HEADER_CLASS
                )}
                aria-hidden
              />
            </tr>
          </thead>
          <tbody className={embedded ? STAFFING_MATRIX_EMBEDDED_ROW_CLASS : undefined}>
            {configuredServiceHours.map((hour, rowIndex) => {
              const isSelected = hour.id === selectedServiceHourId;
              const showDayLabel =
                rowIndex === 0 ||
                configuredServiceHours[rowIndex - 1]!.weekday !== hour.weekday;
              const dayLabel = formatServiceHourStaffingDayLabel(
                hour,
                (weekday) => weekdayLabelFromIndex(weekday, t)
              );
              const timeLabel = formatServiceHourStaffingTimeLabel(
                hour,
                shiftTemplates
              );
              const timeColumnTooltip = `${dayLabel}\n${timeLabel}`;
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
                  {!embedded ? (
                    <td
                      className={cn(
                        settingsIndicatorCellClass(isSelected),
                        STAFFING_MATRIX_BODY_INDICATOR_CLASS
                      )}
                      aria-hidden
                    />
                  ) : null}
                  <td
                    className={
                      embedded
                        ? staffingMatrixEmbeddedDayCellClass(
                            isSelected,
                            STAFFING_MATRIX_BODY_DAY_CLASS
                          )
                        : staffingMatrixDataCellClass(
                            isSelected,
                            false,
                            cn(
                              STAFFING_MATRIX_BODY_DAY_CLASS,
                              STAFFING_MATRIX_BODY_DAY_STICKY_LEFT_CLASS
                            )
                          )
                    }
                  >
                    {embedded ? (
                      <Tooltip content={timeColumnTooltip}>
                        {showDayLabel ? (
                          <span className="block font-semibold leading-none text-black">
                            {dayLabel}
                          </span>
                        ) : (
                          <span className="block min-h-[1em] w-full" aria-hidden />
                        )}
                      </Tooltip>
                    ) : (
                      dayLabel
                    )}
                  </td>
                  <td
                    className={staffingMatrixDataCellClass(
                      isSelected,
                      embedded,
                      cn(
                        STAFFING_MATRIX_BODY_TIME_COLUMN_CLASS,
                        "truncate whitespace-nowrap"
                      )
                    )}
                  >
                    {embedded ? (
                      <Tooltip content={timeColumnTooltip}>
                        <span className="block max-w-full truncate leading-none">
                          {timeLabel}
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="block max-w-full truncate">{timeLabel}</span>
                    )}
                  </td>
                  <td
                    className={staffingMatrixDataCellClass(
                      isSelected,
                      embedded,
                      "min-w-0 whitespace-normal break-words text-sm leading-none"
                    )}
                  >
                    {qualificationsText ? (
                      <span className="block max-w-full">{qualificationsText}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={cn(
                      settingsListRowDeleteCellClass(isSelected),
                      "w-10 pr-2.5",
                      embedded && "py-0"
                    )}
                  >
                    <SettingsListRowDeleteButton
                      label={t("locations.delete")}
                      disabled={loading || !onDeleteServiceHour}
                      className={embedded ? "h-[25px] w-[25px] [&_svg]:size-4" : undefined}
                      showTooltip={!embedded}
                      onClick={() => onDeleteServiceHour?.(hour.id)}
                    />
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
