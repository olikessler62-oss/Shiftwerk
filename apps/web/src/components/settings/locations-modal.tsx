"use client";

import {
  useCallback,
  useEffect,
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
import { formatActiveWeekdaysLabel } from "@schichtwerk/database";
import type { Location, LocationArea } from "@schichtwerk/types";
import { resolveSelectedLocationId } from "@/lib/resolve-dashboard-location";
import { LocationFormModal } from "./location-form-modal";
import { LocationAreaFormModal } from "./location-area-form-modal";
import {
  LocationAreaStaffingMatrix,
  type LocationAreaStaffingMatrixHandle,
} from "./location-area-staffing-matrix";
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

/** Kopfzeile + max. 6 Datenzeilen; bei wenig Viewport-Höhe früher scrollen */
const LIST_SCROLL_MAX_CLASS =
  "max-h-[min(calc(1.75rem+12rem),calc(100dvh-18rem))] overflow-y-auto";
const MAX_NAME_DISPLAY = 25;
const MODAL_MAX_WIDTH = "calc(72rem + 140px)";
const COLUMN_GAP_PX = 20;
/** Bereiche −50px / Personalbedarf +80px relativ zu gleicher Spaltenbreite */
const COL_LOCATIONS_CLASS = "min-w-0 flex-[1.05_1_0]";
const COL_AREAS_CLASS = "min-w-0 flex-[0.82_1_0]";
const COL_STAFFING_CLASS = "min-w-0 flex-[1.33_1_0]";

function weekdayLocale(locale: string): "de" | "en" {
  return locale === "en" ? "en" : "de";
}

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function ColumnActionButton({
  className,
  variant = "outline",
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={cn(
        "h-7 w-auto shrink-0 gap-1 whitespace-nowrap px-2 text-xs",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

function ColumnShell({
  title,
  children,
  actions,
  confirm,
  className,
  listScrollClassName = LIST_SCROLL_MAX_CLASS,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  confirm?: ReactNode;
  className?: string;
  listScrollClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60",
        className
      )}
    >
      <h3
        className="shrink-0 truncate border-b border-border bg-subtle px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground"
        title={title}
      >
        {title}
      </h3>
      <div
        className={cn(
          "bg-background px-2 py-2",
          listScrollClassName
        )}
      >
        <div className="min-w-0 rounded-md border border-border bg-surface">
          {children}
        </div>
      </div>
      {confirm}
      <div className="flex shrink-0 flex-wrap items-center justify-start gap-1.5 border-t border-border bg-subtle px-2 py-2">
        {actions}
      </div>
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
  const [confirmClearStaffing, setConfirmClearStaffing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const overlayFormOpen = !!locationFormMode || !!areaFormMode;
  const abbrevLocale = weekdayLocale(locale);
  const selectedLocation = list.find((l) => l.id === selectedLocationId);
  const selectedArea = areas.find((a) => a.id === selectedAreaId);
  const staffingReady = !!selectedLocation && !!selectedArea && !areasLoading;
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
    setConfirmClearStaffing(false);
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
      if (confirmClearStaffing) {
        setConfirmClearStaffing(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    areaFormMode,
    confirmClearStaffing,
    confirmDeleteArea,
    confirmDeleteLocation,
    locationFormMode,
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
    setConfirmClearStaffing(false);
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

  function handleStaffingReload() {
    staffingRef.current?.reload();
    setConfirmClearStaffing(false);
  }

  function handleStaffingSave() {
    setErrorMessage(null);
    void staffingRef.current?.save();
  }

  function handleStaffingClear() {
    setErrorMessage(null);
    startTransition(async () => {
      const ok = await staffingRef.current?.clear();
      if (ok) setConfirmClearStaffing(false);
    });
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !overlayFormOpen &&
          !confirmDeleteLocation &&
          !confirmDeleteArea &&
          !confirmClearStaffing
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
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            overlayFormOpen ? "pointer-events-none" : ""
          )}
        >
          <div className="shrink-0 border-b border-border px-6 py-4">
            <h2
              id="locations-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              {t("locations.title")}
            </h2>
          </div>

          {errorMessage && (
            <div className="mx-4 mt-3 shrink-0">
              <Alert variant="error">{errorMessage}</Alert>
            </div>
          )}

          <div
            className="flex shrink-0 bg-background px-4 py-3"
            style={{ gap: COLUMN_GAP_PX }}
          >
            {/* Spalte 1: Standorte */}
            <ColumnShell
              className={COL_LOCATIONS_CLASS}
              title={t("locations.panelLocations")}
              confirm={
                confirmDeleteLocation && selectedLocation ? (
                  <div className="mx-2 mb-1 rounded-[var(--radius-control)] border border-border bg-subtle px-2 py-1.5 text-xs">
                    <span className="block truncate" title={selectedLocation.name}>
                      <strong>{truncateLabel(selectedLocation.name)}</strong>{" "}
                      {t("locations.confirmDelete")}
                    </span>
                    <div className="mt-1.5 flex flex-wrap justify-start gap-1">
                      <ColumnActionButton
                        disabled={pending}
                        onClick={() => setConfirmDeleteLocation(false)}
                      >
                        <CloseIcon />
                        {t("locations.no")}
                      </ColumnActionButton>
                      <ColumnActionButton
                        variant="danger"
                        disabled={pending}
                        onClick={handleDeleteLocation}
                      >
                      <TrashIcon />
                      {t("locations.yesDelete")}
                    </ColumnActionButton>
                    </div>
                  </div>
                ) : null
              }
              actions={
                <>
                  <ColumnActionButton
                    disabled={pending}
                    onClick={() => {
                      setLocationFormMode({ type: "create" });
                      setConfirmDeleteLocation(false);
                    }}
                  >
                    <PlusIcon />
                    {t("locations.new")}
                  </ColumnActionButton>
                  <ColumnActionButton
                    disabled={pending || !selectedLocation}
                    onClick={() => {
                      if (!selectedLocation) return;
                      openEditLocation(selectedLocation);
                    }}
                  >
                    <PencilIcon />
                    {t("locations.edit")}
                  </ColumnActionButton>
                  <ColumnActionButton
                    disabled={pending || !selectedLocation}
                    onClick={() => {
                      setConfirmDeleteLocation(true);
                      setErrorMessage(null);
                    }}
                  >
                    <TrashIcon />
                    {t("locations.delete")}
                  </ColumnActionButton>
                </>
              }
            >
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-subtle text-center">
                    <th className="px-1 pb-1.5 font-semibold text-muted">
                      {t("locations.columnName")}
                    </th>
                    <th className="px-1 pb-1.5 font-semibold text-muted">
                      {t("locations.columnWeekdays")}
                    </th>
                    <th className="px-1 pb-1.5 font-semibold text-muted">
                      {t("locations.columnHolidayService")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-muted">
                        {t("locations.emptyList")}
                      </td>
                    </tr>
                  ) : (
                    list.map((item) => {
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
                            className={cn(
                              "h-8 cursor-pointer select-none border-b border-border last:border-0",
                              isSelected
                                ? "bg-subtle ring-1 ring-inset ring-border"
                                : "hover:bg-hover"
                            )}
                          >
                            <td
                              className={cn(
                                "h-8 max-w-[6.5rem] truncate border-l-4 px-1 py-0 text-center font-medium",
                                isSelected
                                  ? "border-l-foreground"
                                  : "border-l-transparent"
                              )}
                              title={item.name}
                            >
                              {truncateLabel(item.name)}
                            </td>
                            <td
                              className="h-8 max-w-[5.5rem] truncate px-0.5 py-0 text-center"
                              title={formatActiveWeekdaysLabel(
                                item.active_weekdays,
                                abbrevLocale
                              )}
                            >
                              {formatActiveWeekdaysLabel(
                                item.active_weekdays,
                                abbrevLocale
                              )}
                            </td>
                            <td className="h-8 px-0.5 py-0 text-center">
                            {item.on_holiday_open ? t("locations.yes") : t("locations.no")}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ColumnShell>

            {/* Spalte 2: Bereiche */}
            <ColumnShell
              className={COL_AREAS_CLASS}
              title={areasPanelTitle}
              confirm={
                confirmDeleteArea && selectedArea ? (
                  <div className="mx-2 mb-1 rounded-[var(--radius-control)] border border-border bg-subtle px-2 py-1.5 text-xs">
                    <span className="block truncate" title={selectedArea.name}>
                      <strong>{truncateLabel(selectedArea.name)}</strong>{" "}
                      {t("locations.confirmDeleteArea")}
                    </span>
                    <div className="mt-1.5 flex flex-wrap justify-start gap-1">
                      <ColumnActionButton
                        disabled={pending}
                        onClick={() => setConfirmDeleteArea(false)}
                      >
                        <CloseIcon />
                        {t("locations.no")}
                      </ColumnActionButton>
                      <ColumnActionButton
                        variant="danger"
                        disabled={pending}
                        onClick={handleDeleteArea}
                      >
                        <TrashIcon />
                        {t("locations.yesDelete")}
                      </ColumnActionButton>
                    </div>
                  </div>
                ) : null
              }
              actions={
                <>
                  <ColumnActionButton
                    disabled={pending || !selectedLocationId}
                    onClick={() => {
                      if (!selectedLocationId) return;
                      setAreaFormMode({ type: "create" });
                      setConfirmDeleteArea(false);
                    }}
                  >
                    <PlusIcon />
                    {t("locations.areaNew")}
                  </ColumnActionButton>
                  <ColumnActionButton
                    disabled={pending || !selectedArea}
                    onClick={() => {
                      if (!selectedArea) return;
                      openEditArea(selectedArea);
                    }}
                  >
                    <PencilIcon />
                    {t("locations.areaEdit")}
                  </ColumnActionButton>
                  <ColumnActionButton
                    disabled={pending || !selectedArea}
                    onClick={() => {
                      setConfirmDeleteArea(true);
                      setErrorMessage(null);
                    }}
                  >
                    <TrashIcon />
                    {t("locations.areaDelete")}
                  </ColumnActionButton>
                </>
              }
            >
              {!selectedLocationId ? (
                <p className="py-4 text-center text-muted">{t("locations.areasNoLocation")}</p>
              ) : areasLoading ? (
                <p className="py-4 text-center text-muted">{t("common.loading")}</p>
              ) : areas.length === 0 ? (
                <p className="py-4 text-center text-muted">{t("locations.areasEmpty")}</p>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-subtle text-center">
                      <th className="px-1 pb-1.5 font-semibold text-muted">
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
                            setConfirmClearStaffing(false);
                            setErrorMessage(null);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            window.getSelection()?.removeAllRanges();
                            openEditArea(area);
                          }}
                          className={cn(
                            "h-8 cursor-pointer select-none border-b border-border last:border-0",
                            isSelected
                              ? "bg-subtle ring-1 ring-inset ring-border"
                              : "hover:bg-hover"
                          )}
                        >
                          <td
                            className={cn(
                              "h-8 max-w-[8rem] truncate border-l-4 px-1 py-0 text-center font-medium",
                              isSelected
                                ? "border-l-foreground"
                                : "border-l-transparent"
                            )}
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
              listScrollClassName="overflow-visible px-0 py-0"
              confirm={
                confirmClearStaffing && selectedArea ? (
                  <div className="mx-2 mb-1 rounded-[var(--radius-control)] border border-border bg-subtle px-2 py-1.5 text-xs">
                    {t("locations.confirmClearStaffing")}
                    <div className="mt-1.5 flex flex-wrap justify-start gap-1">
                      <ColumnActionButton
                        disabled={pending}
                        onClick={() => setConfirmClearStaffing(false)}
                      >
                        <CloseIcon />
                        {t("locations.no")}
                      </ColumnActionButton>
                      <ColumnActionButton
                        variant="danger"
                        disabled={pending}
                        onClick={handleStaffingClear}
                      >
                        <TrashIcon />
                        {t("locations.yesDelete")}
                      </ColumnActionButton>
                    </div>
                  </div>
                ) : null
              }
              actions={
                <>
                  <ColumnActionButton
                    disabled={pending || !staffingReady}
                    onClick={handleStaffingReload}
                    title={t("locations.staffingHint")}
                  >
                    <PlusIcon />
                    {t("locations.new")}
                  </ColumnActionButton>
                  <ColumnActionButton
                    disabled={pending || !staffingReady}
                    onClick={handleStaffingSave}
                  >
                    <PencilIcon />
                    {t("locations.edit")}
                  </ColumnActionButton>
                  <ColumnActionButton
                    disabled={pending || !staffingReady}
                    onClick={() => setConfirmClearStaffing(true)}
                  >
                    <TrashIcon />
                    {t("locations.delete")}
                  </ColumnActionButton>
                </>
              }
            >
              {!staffingReady ? (
                <p className="py-4 text-center text-muted">
                  {!selectedLocationId
                    ? t("locations.areasNoLocation")
                    : areasLoading
                      ? t("common.loading")
                      : t("locations.areasEmpty")}
                </p>
              ) : selectedLocation && selectedArea ? (
                <LocationAreaStaffingMatrix
                  ref={staffingRef}
                  embedded
                  listScrollClassName={LIST_SCROLL_MAX_CLASS}
                  location={selectedLocation}
                  area={selectedArea}
                  disabled={pending || overlayFormOpen || confirmClearStaffing}
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
      </div>
    </div>
  );
}
