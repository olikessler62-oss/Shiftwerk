"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { deleteLocation } from "@/app/actions/locations";
import {
  archiveLocationArea,
  fetchLocationAreas,
} from "@/app/actions/location-areas";
import { deleteShiftTypeStaffing } from "@/app/actions/location-staffing";
import { formatLocationOpenDaysLabel } from "@schichtwerk/database";
import type {
  Location,
  LocationArea,
  LocationAreaStaffing,
  ShiftType,
} from "@schichtwerk/types";
import { resolveSelectedLocationId } from "@/lib/resolve-dashboard-location";
import { LocationFormModal } from "./location-form-modal";
import { LocationAreaFormModal } from "./location-area-form-modal";
import {
  LocationAreaStaffingMatrix,
  type LocationAreaStaffingMatrixHandle,
} from "./location-area-staffing-matrix";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { LocationStaffingFormModal } from "./location-staffing-form-modal";
import {
  SETTINGS_LIST_SCROLL_COMPACT_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  settingsColumnHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsPanelHeaderClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";

type Props = {
  locations: Location[];
  onClose: () => void;
  /** Gleiche Auswahl wie Dashboard — vermeidet Hydration-Mismatch mit dynamischen Panel-Titeln */
  initialSelectedLocationId?: string | null;
  initialAreas?: LocationArea[];
  initialSelectedAreaId?: string | null;
};

type LocationFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; location: Location };

type AreaFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; area: LocationArea };

type StaffingFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; shiftTypeId: string };

/** Bereiche −30px / Standorte +30px (basis); Personalbedarf +80px relativ zu gleicher Spaltenbreite */
const COL_LOCATIONS_CLASS = "min-w-0 flex-[1.05_1_30px]";
const COL_AREAS_CLASS = "min-w-0 flex-[0.82_1_0]";
const COL_STAFFING_CLASS = "min-w-0 flex-[1.33_1_0]";

function weekdayLocale(locale: string): "de" | "en" {
  return locale === "en" ? "en" : "de";
}

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

const MAX_NAME_DISPLAY = 25;
const MODAL_MAX_WIDTH = "calc(72rem + 140px)";
const COLUMN_GAP_PX = 20;

function ColumnActionButton({
  className,
  variant = "outline",
  label,
  icon,
  title,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  icon: ReactNode;
}) {
  return (
    <SettingsIconActionButton
      label={label}
      icon={icon}
      title={title}
      variant={variant}
      className={className}
      {...props}
    />
  );
}

function ColumnPrimaryButton({
  label,
  icon,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  icon: ReactNode;
}) {
  return <SettingsPrimaryActionButton label={label} icon={icon} {...props} />;
}

function ColumnShell({
  title,
  children,
  actions,
  confirm,
  className,
  listScrollClassName = SETTINGS_LIST_SCROLL_COMPACT_CLASS,
  listPaddingClassName = "px-2 py-2",
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  confirm?: ReactNode;
  className?: string;
  listScrollClassName?: string;
  listPaddingClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60",
        className
      )}
    >
      <h3 className={settingsPanelHeaderClass()} title={title}>
        {title}
      </h3>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className={cn("min-h-0 bg-background", listPaddingClassName)}>
          <div
            className={cn(
              "min-h-0 overflow-y-auto rounded-md border border-border bg-surface",
              listScrollClassName
            )}
          >
            {children}
          </div>
        </div>
        {confirm ? (
          <div className="absolute inset-x-2 bottom-2 z-10">{confirm}</div>
        ) : null}
      </div>
      <div className="mt-auto shrink-0">{actions}</div>
    </div>
  );
}

function resolveInitialAreaId(
  areas: LocationArea[],
  preferredId: string | null | undefined
): string | null {
  if (areas.length === 0) return null;
  if (preferredId && areas.some((a) => a.id === preferredId)) return preferredId;
  return areas[0]?.id ?? null;
}

export function LocationsModal({
  locations,
  onClose,
  initialSelectedLocationId = null,
  initialAreas = [],
  initialSelectedAreaId = null,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const staffingRef = useRef<LocationAreaStaffingMatrixHandle>(null);
  const initialLocationId = resolveSelectedLocationId(
    locations,
    initialSelectedLocationId ?? undefined
  );
  const hasPrefetchedAreas =
    initialLocationId != null &&
    initialLocationId === initialSelectedLocationId;
  const skipInitialAreasFetch = useRef(hasPrefetchedAreas);

  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(locations);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    initialLocationId
  );
  const [areas, setAreas] = useState<LocationArea[]>(() =>
    hasPrefetchedAreas ? initialAreas : []
  );
  const [areasLoading, setAreasLoading] = useState(
    () => !!initialLocationId && !hasPrefetchedAreas
  );
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(() =>
    hasPrefetchedAreas
      ? resolveInitialAreaId(initialAreas, initialSelectedAreaId)
      : null
  );

  const [locationFormMode, setLocationFormMode] = useState<LocationFormMode>(null);
  const [areaFormMode, setAreaFormMode] = useState<AreaFormMode>(null);
  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState(false);
  const [confirmDeleteArea, setConfirmDeleteArea] = useState(false);
  const [confirmDeleteStaffing, setConfirmDeleteStaffing] = useState(false);
  const [staffingFormMode, setStaffingFormMode] = useState<StaffingFormMode>(null);
  const [selectedStaffingShiftTypeId, setSelectedStaffingShiftTypeId] =
    useState<string | null>(null);
  const [staffingEditorData, setStaffingEditorData] = useState<{
    shiftTypes: ShiftType[];
    staffing: LocationAreaStaffing[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [staffingLoading, setStaffingLoading] = useState(
    () => hasPrefetchedAreas && !!resolveInitialAreaId(initialAreas, initialSelectedAreaId)
  );

  const overlayFormOpen =
    !!locationFormMode || !!areaFormMode || !!staffingFormMode;
  const configuredStaffingShiftTypeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rule of staffingEditorData?.staffing ?? []) {
      if (rule.required_count > 0) ids.add(rule.shift_type_id);
    }
    return ids;
  }, [staffingEditorData]);
  const hasUnassignedShiftTypes = (staffingEditorData?.shiftTypes ?? []).some(
    (type) => !configuredStaffingShiftTypeIds.has(type.id)
  );
  const abbrevLocale = weekdayLocale(locale);
  const selectedLocation = list.find((l) => l.id === selectedLocationId);
  const selectedArea = areas.find((a) => a.id === selectedAreaId);
  const staffingReady = !!selectedLocation && !!selectedArea && !areasLoading;
  const listsLoading = areasLoading || staffingLoading;

  useLayoutEffect(() => {
    if (!staffingReady) {
      setStaffingLoading(false);
    } else {
      setStaffingLoading(true);
    }
  }, [staffingReady, selectedAreaId]);
  const areasPanelTitle = selectedLocation
    ? t("locations.panelAreasOf", { location: selectedLocation.name })
    : t("locations.panelAreas");
  const staffingPanelTitle =
    selectedLocation && selectedArea
      ? t("locations.panelStaffingOf", {
          location: selectedLocation.name,
          area: selectedArea.name,
        })
      : t("locations.panelStaffing");
  const selectedStaffingShiftType =
    staffingEditorData?.shiftTypes.find(
      (type) => type.id === selectedStaffingShiftTypeId
    ) ?? null;

  const loadAreas = useCallback((locationId: string) => {
    startTransition(async () => {
      const result = await fetchLocationAreas(locationId);
      setAreasLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        setAreas([]);
        setSelectedAreaId(null);
        return;
      }
      setAreas(result.areas ?? []);
      setSelectedAreaId((current) => {
        if (current && result.areas?.some((a) => a.id === current)) return current;
        return result.areas?.[0]?.id ?? null;
      });
    });
  }, []);

  useEffect(() => {
    setList(locations);
    setSelectedLocationId((current) => {
      if (current && locations.some((l) => l.id === current)) return current;
      return resolveSelectedLocationId(
        locations,
        initialSelectedLocationId ?? undefined
      );
    });
  }, [locations, initialSelectedLocationId]);

  useEffect(() => {
    if (!selectedLocationId) {
      setAreas([]);
      setSelectedAreaId(null);
      setAreasLoading(false);
      return;
    }
    if (skipInitialAreasFetch.current) {
      skipInitialAreasFetch.current = false;
      return;
    }
    setConfirmDeleteArea(false);
    setConfirmDeleteStaffing(false);
    setSelectedStaffingShiftTypeId(null);
    setStaffingEditorData(null);
    setAreas([]);
    setSelectedAreaId(null);
    setAreasLoading(true);
    loadAreas(selectedLocationId);
  }, [selectedLocationId, loadAreas]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (locationFormMode) {
        setLocationFormMode(null);
        return;
      }
      if (areaFormMode) {
        setAreaFormMode(null);
        return;
      }
      if (confirmDeleteLocation) {
        setConfirmDeleteLocation(false);
        return;
      }
      if (confirmDeleteArea) {
        setConfirmDeleteArea(false);
        return;
      }
      if (staffingFormMode) {
        setStaffingFormMode(null);
        return;
      }
      if (confirmDeleteStaffing) {
        setConfirmDeleteStaffing(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    areaFormMode,
    confirmDeleteStaffing,
    confirmDeleteArea,
    confirmDeleteLocation,
    locationFormMode,
    staffingFormMode,
    onClose,
  ]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function refreshList() {
    router.refresh();
  }

  function selectLocation(id: string) {
    if (id === selectedLocationId) return;
    setSelectedLocationId(id);
    setAreas([]);
    setSelectedAreaId(null);
    setAreasLoading(true);
    setConfirmDeleteLocation(false);
    setConfirmDeleteArea(false);
    setConfirmDeleteStaffing(false);
    setSelectedStaffingShiftTypeId(null);
    setStaffingEditorData(null);
    setErrorMessage(null);
  }

  function openEditLocation(location: Location) {
    setLocationFormMode({ type: "edit", location });
    setConfirmDeleteLocation(false);
    setErrorMessage(null);
  }

  function handleDeleteLocation() {
    if (!selectedLocation) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteLocation(selectedLocation.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDeleteLocation(false);
        return;
      }
      setList((prev) => {
        const remaining = prev.filter((l) => l.id !== selectedLocation.id);
        setSelectedLocationId(remaining[0]?.id ?? null);
        return remaining;
      });
      setConfirmDeleteLocation(false);
      refreshList();
    });
  }

  function openEditArea(area: LocationArea) {
    setAreaFormMode({ type: "edit", area });
    setConfirmDeleteArea(false);
    setErrorMessage(null);
  }

  function handleDeleteArea() {
    if (!selectedArea || !selectedLocationId) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await archiveLocationArea({
        id: selectedArea.id,
        locationId: selectedLocationId,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDeleteArea(false);
        return;
      }
      setAreas(result.areas ?? []);
      setSelectedAreaId(result.areas?.[0]?.id ?? null);
      setConfirmDeleteArea(false);
      refreshList();
    });
  }

  function handleStaffingSaved() {
    staffingRef.current?.reload();
    refreshList();
  }

  function handleDeleteStaffing() {
    if (!selectedLocation || !selectedArea || !selectedStaffingShiftTypeId) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteShiftTypeStaffing({
        locationId: selectedLocation.id,
        locationAreaId: selectedArea.id,
        shiftTypeId: selectedStaffingShiftTypeId,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDeleteStaffing(false);
        return;
      }
      setConfirmDeleteStaffing(false);
      setSelectedStaffingShiftTypeId(null);
      handleStaffingSaved();
    });
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4",
        listsLoading && "cursor-wait"
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !overlayFormOpen &&
          !confirmDeleteLocation &&
          !confirmDeleteArea &&
          !confirmDeleteStaffing
        ) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex w-full flex-col"
        style={{ maxWidth: MODAL_MAX_WIDTH }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="locations-modal-title"
          aria-hidden={overlayFormOpen}
          aria-busy={listsLoading}
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            overlayFormOpen ? "pointer-events-none" : "",
            listsLoading && "[&_*]:cursor-wait"
          )}
        >
          <div className="shrink-0 border-b border-border px-6 py-4">
            <h2 id="locations-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("locations.title")}
            </h2>
          </div>

          {errorMessage && (
            <div className="mx-4 mt-3 shrink-0">
              <Alert variant="error">{errorMessage}</Alert>
            </div>
          )}

          <div
            className="flex shrink-0 items-stretch bg-background px-4 py-3"
            style={{ gap: COLUMN_GAP_PX }}
          >
            {/* Spalte 1: Standorte */}
            <ColumnShell
              className={COL_LOCATIONS_CLASS}
              title={t("locations.panelLocations")}
              actions={
                <SettingsActionBar
                  primary={
                    <ColumnPrimaryButton
                      label={t("locations.new")}
                      icon={<PlusIcon />}
                      disabled={pending}
                      onClick={() => {
                        setLocationFormMode({ type: "create" });
                        setConfirmDeleteLocation(false);
                      }}
                    />
                  }
                  secondary={
                    <ColumnActionButton
                      label={t("locations.edit")}
                      icon={<PencilIcon />}
                      disabled={pending || !selectedLocation}
                      onClick={() => {
                        if (!selectedLocation) return;
                        openEditLocation(selectedLocation);
                      }}
                    />
                  }
                  destructive={
                    <ColumnActionButton
                      label={t("locations.delete")}
                      icon={<TrashIcon />}
                      disabled={pending || !selectedLocation}
                      onClick={() => {
                        setConfirmDeleteLocation(true);
                        setErrorMessage(null);
                      }}
                    />
                  }
                />
              }
            >
              {list.length === 0 ? (
                <SettingsEmptyState
                  message={t("locations.emptyList")}
                  hint={t("common.emptyHintCreate")}
                />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-subtle">
                      <th className="w-1 p-0" aria-hidden />
                      <th className={settingsColumnHeaderClass()}>{t("locations.columnName")}</th>
                      <th className={settingsColumnHeaderClass("center")}>{t("locations.columnWeekdays")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item) => {
                      const isSelected = item.id === selectedLocationId;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => selectLocation(item.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            window.getSelection()?.removeAllRanges();
                            openEditLocation(item);
                          }}
                          className={settingsDataRowClass(isSelected)}
                        >
                          <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                          <td
                            className={settingsDataCellClass(isSelected, {
                              className: "max-w-[6.5rem] truncate font-medium",
                            })}
                            title={item.name}
                          >
                            {truncateLabel(item.name)}
                          </td>
                          <td
                            className={settingsDataCellClass(isSelected, {
                              align: "center",
                              className: "max-w-[8rem] truncate",
                            })}
                            title={formatLocationOpenDaysLabel(
                              item.active_weekdays,
                              item.on_holiday_open,
                              t("locations.weekdays.holiday"),
                              abbrevLocale
                            )}
                          >
                            {formatLocationOpenDaysLabel(
                              item.active_weekdays,
                              item.on_holiday_open,
                              t("locations.weekdays.holiday"),
                              abbrevLocale
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ColumnShell>

            {/* Spalte 2: Bereiche */}
            <ColumnShell
              className={COL_AREAS_CLASS}
              title={areasPanelTitle}
              actions={
                <SettingsActionBar
                  primary={
                    <ColumnPrimaryButton
                      label={t("locations.areaNew")}
                      icon={<PlusIcon />}
                      disabled={pending || !selectedLocationId}
                      onClick={() => {
                        if (!selectedLocationId) return;
                        setAreaFormMode({ type: "create" });
                        setConfirmDeleteArea(false);
                      }}
                    />
                  }
                  secondary={
                    <ColumnActionButton
                      label={t("locations.areaEdit")}
                      icon={<PencilIcon />}
                      disabled={pending || !selectedArea}
                      onClick={() => {
                        if (!selectedArea) return;
                        openEditArea(selectedArea);
                      }}
                    />
                  }
                  destructive={
                    <ColumnActionButton
                      label={t("locations.areaDelete")}
                      icon={<TrashIcon />}
                      disabled={pending || !selectedArea}
                      onClick={() => {
                        setConfirmDeleteArea(true);
                        setErrorMessage(null);
                      }}
                    />
                  }
                />
              }
            >
              {!selectedLocationId ? (
                <SettingsEmptyState message={t("locations.areasNoLocation")} />
              ) : areasLoading ? (
                <SettingsEmptyState message={t("common.loading")} />
              ) : areas.length === 0 ? (
                <SettingsEmptyState
                  message={t("locations.areasEmpty")}
                  hint={t("common.emptyHintCreate")}
                />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-subtle">
                      <th className="w-1 p-0" aria-hidden />
                      <th className={cn(settingsColumnHeaderClass(), "text-left")}>
                        {t("locations.areaName")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((area) => {
                      const isSelected = area.id === selectedAreaId;
                      return (
                        <tr
                          key={area.id}
                          onClick={() => {
                            setSelectedAreaId(area.id);
                            setConfirmDeleteArea(false);
                            setConfirmDeleteStaffing(false);
                            setSelectedStaffingShiftTypeId(null);
                            setStaffingEditorData(null);
                            setErrorMessage(null);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            window.getSelection()?.removeAllRanges();
                            openEditArea(area);
                          }}
                          className={settingsDataRowClass(isSelected)}
                        >
                          <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                          <td
                            className={settingsDataCellClass(isSelected, {
                              className: "max-w-[8rem] truncate font-medium",
                            })}
                            title={area.name}
                          >
                            {truncateLabel(area.name)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ColumnShell>

            {/* Spalte 3: Personalbedarf */}
            <ColumnShell
              className={COL_STAFFING_CLASS}
              title={staffingPanelTitle}
              listPaddingClassName="px-0 py-0"
              actions={
                <SettingsActionBar
                  primary={
                    <ColumnPrimaryButton
                      label={t("locations.new")}
                      icon={<PlusIcon />}
                      disabled={pending || !staffingReady || !hasUnassignedShiftTypes}
                      onClick={() => {
                        setStaffingFormMode({ type: "create" });
                        setConfirmDeleteStaffing(false);
                        setErrorMessage(null);
                      }}
                    />
                  }
                  secondary={
                    <ColumnActionButton
                      label={t("locations.edit")}
                      icon={<PencilIcon />}
                      disabled={pending || !staffingReady || !selectedStaffingShiftTypeId}
                      onClick={() => {
                        if (!selectedStaffingShiftTypeId) return;
                        setStaffingFormMode({
                          type: "edit",
                          shiftTypeId: selectedStaffingShiftTypeId,
                        });
                        setConfirmDeleteStaffing(false);
                        setErrorMessage(null);
                      }}
                    />
                  }
                  destructive={
                    <ColumnActionButton
                      label={t("locations.delete")}
                      icon={<TrashIcon />}
                      disabled={pending || !staffingReady || !selectedStaffingShiftTypeId}
                      onClick={() => {
                        setConfirmDeleteStaffing(true);
                        setErrorMessage(null);
                      }}
                    />
                  }
                />
              }
            >
              {!staffingReady ? (
                <SettingsEmptyState
                  message={
                    !selectedLocationId
                      ? t("locations.areasNoLocation")
                      : areasLoading
                        ? t("common.loading")
                        : t("locations.areasEmpty")
                  }
                />
              ) : selectedLocation && selectedArea ? (
                <LocationAreaStaffingMatrix
                  ref={staffingRef}
                  embedded
                  location={selectedLocation}
                  area={selectedArea}
                  selectedShiftTypeId={selectedStaffingShiftTypeId}
                  onSelectShiftType={setSelectedStaffingShiftTypeId}
                  onDataLoaded={setStaffingEditorData}
                  onLoadingChange={setStaffingLoading}
                />
              ) : null}
            </ColumnShell>
          </div>

          <div className="flex shrink-0 justify-end border-t border-border px-6 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
            >
              <CloseIcon />
              {t("common.close")}
            </Button>
          </div>
        </div>

        {locationFormMode?.type === "create" && (
          <LocationFormModal
            mode="create"
            existingLocations={list}
            onClose={() => setLocationFormMode(null)}
            onSaved={refreshList}
          />
        )}
        {locationFormMode?.type === "edit" && (
          <LocationFormModal
            mode="edit"
            location={locationFormMode.location}
            existingLocations={list}
            onClose={() => setLocationFormMode(null)}
            onSaved={refreshList}
          />
        )}
        {areaFormMode?.type === "create" && selectedLocationId && (
          <LocationAreaFormModal
            mode="create"
            locationId={selectedLocationId}
            existingAreas={areas}
            onClose={() => setAreaFormMode(null)}
            onSaved={() => loadAreas(selectedLocationId)}
          />
        )}
        {areaFormMode?.type === "edit" && selectedLocationId && (
          <LocationAreaFormModal
            mode="edit"
            locationId={selectedLocationId}
            area={areaFormMode.area}
            existingAreas={areas}
            onClose={() => setAreaFormMode(null)}
            onSaved={() => loadAreas(selectedLocationId)}
          />
        )}
        {confirmDeleteLocation && selectedLocation && (
          <DeleteConfirmModal
            name={selectedLocation.name}
            pending={pending}
            onCancel={() => setConfirmDeleteLocation(false)}
            onConfirm={handleDeleteLocation}
          />
        )}
        {confirmDeleteArea && selectedArea && (
          <DeleteConfirmModal
            name={selectedArea.name}
            pending={pending}
            onCancel={() => setConfirmDeleteArea(false)}
            onConfirm={handleDeleteArea}
          />
        )}
        {confirmDeleteStaffing && selectedStaffingShiftType && (
          <DeleteConfirmModal
            name={selectedStaffingShiftType.name}
            pending={pending}
            onCancel={() => setConfirmDeleteStaffing(false)}
            onConfirm={handleDeleteStaffing}
          />
        )}
        {staffingFormMode &&
          selectedLocation &&
          selectedArea &&
          staffingEditorData && (
            <LocationStaffingFormModal
              mode={staffingFormMode.type}
              location={selectedLocation}
              area={selectedArea}
              shiftTypes={staffingEditorData.shiftTypes}
              staffing={staffingEditorData.staffing}
              initialShiftTypeId={
                staffingFormMode.type === "edit"
                  ? staffingFormMode.shiftTypeId
                  : undefined
              }
              onClose={() => setStaffingFormMode(null)}
              onSaved={handleStaffingSaved}
            />
          )}
      </div>
    </div>
  );
}
