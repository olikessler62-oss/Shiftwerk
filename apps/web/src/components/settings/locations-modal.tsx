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
import { deleteLocation, reorderLocations } from "@/app/actions/locations";
import {
  archiveLocationArea,
  fetchLocationAreas,
  reorderLocationAreas,
} from "@/app/actions/location-areas";
import type {
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
} from "@schichtwerk/types";
import { fetchLocationStaffingEditor } from "@/app/actions/location-staffing";
import { fetchLocationAreaServiceHours } from "@/app/actions/location-service-hours";
import { resolveSelectedLocationId } from "@/lib/resolve-dashboard-location";
import { LocationFormModal } from "./location-form-modal";
import { LocationAreaFormModal } from "./location-area-form-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { LocationDetailActions } from "./location-detail-actions";
import { LocationServiceHoursPanelModal } from "./location-service-hours-panel-modal";
import { LocationStaffingPanelModal } from "./location-staffing-panel-modal";
import {
  SETTINGS_LIST_SCROLL_COMPACT_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  applyCreatedListSelection,
  settingsListItemAttrs,
  useScrollToSettingsListItem,
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
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";

type Props = {
  locations: Location[];
  onClose: () => void;
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

type DetailPanel = null | "serviceHours" | "staffing";

const MODAL_MAX_WIDTH = "calc(54rem + 120px)";
const COLUMN_GAP_PX = 20;
const MAX_NAME_DISPLAY = 25;

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

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
  listScrollClassName = SETTINGS_LIST_SCROLL_COMPACT_CLASS,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  confirm?: ReactNode;
  listScrollClassName?: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
      <h3 className={settingsPanelHeaderClass()} title={title}>
        {title}
      </h3>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 bg-background px-2 py-2">
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
  const [serviceHoursCache, setServiceHoursCache] = useState<
    Record<string, LocationAreaServiceHour[]>
  >({});
  const [staffingCache, setStaffingCache] = useState<
    Record<string, LocationAreaStaffing[]>
  >({});

  const [locationFormMode, setLocationFormMode] = useState<LocationFormMode>(null);
  const [areaFormMode, setAreaFormMode] = useState<AreaFormMode>(null);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState(false);
  const [confirmDeleteArea, setConfirmDeleteArea] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToLocationId, setScrollToLocationId] = useState<string | null>(null);
  const [scrollToAreaId, setScrollToAreaId] = useState<string | null>(null);

  const overlayFormOpen =
    !!locationFormMode || !!areaFormMode || !!detailPanel;

  const {
    sortedList: sortedLocations,
    canMoveUp: canMoveLocationUp,
    canMoveDown: canMoveLocationDown,
    handleMove: handleMoveLocation,
  } = useSettingsListReorder({
    list,
    setList,
    selectedId: selectedLocationId,
    pending,
    startTransition,
    reorder: reorderLocations,
    onError: setErrorMessage,
    onSuccess: () => router.refresh(),
  });

  const {
    sortedList: sortedAreas,
    canMoveUp: canMoveAreaUp,
    canMoveDown: canMoveAreaDown,
    handleMove: handleMoveArea,
  } = useSettingsListReorder({
    list: areas,
    setList: setAreas,
    selectedId: selectedAreaId,
    pending,
    startTransition,
    reorder: async (orderedIds) => {
      if (!selectedLocationId) {
        return { ok: false, error: "Standort nicht gefunden" };
      }
      return reorderLocationAreas({
        locationId: selectedLocationId,
        orderedIds,
      });
    },
    onError: setErrorMessage,
    onSuccess: () => router.refresh(),
  });

  const selectedLocation = sortedLocations.find((l) => l.id === selectedLocationId);
  const selectedArea = sortedAreas.find((a) => a.id === selectedAreaId);
  const panelAreaReady =
    !!selectedAreaId &&
    selectedAreaId in serviceHoursCache &&
    selectedAreaId in staffingCache;
  const clearLocationScrollTarget = useCallback(
    () => setScrollToLocationId(null),
    []
  );
  const clearAreaScrollTarget = useCallback(() => setScrollToAreaId(null), []);
  useScrollToSettingsListItem(
    sortedLocations,
    scrollToLocationId,
    clearLocationScrollTarget
  );
  useScrollToSettingsListItem(sortedAreas, scrollToAreaId, clearAreaScrollTarget);
  const areasPanelTitle = selectedLocation
    ? t("locations.panelAreasOf", { location: selectedLocation.name })
    : t("locations.panelAreas");

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
    setDetailPanel(null);
    setAreas([]);
    setSelectedAreaId(null);
    setAreasLoading(true);
    loadAreas(selectedLocationId);
  }, [selectedLocationId, loadAreas]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (detailPanel) {
        setDetailPanel(null);
        return;
      }
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
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    areaFormMode,
    confirmDeleteArea,
    confirmDeleteLocation,
    detailPanel,
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

  function handleLocationFormSaved(createdId?: string) {
    applyCreatedListSelection(
      createdId,
      setSelectedLocationId,
      setScrollToLocationId
    );
    refreshList();
  }

  function handleAreaFormSaved(createdId?: string) {
    if (createdId) {
      setSelectedAreaId(createdId);
      setScrollToAreaId(createdId);
    }
    if (selectedLocationId) loadAreas(selectedLocationId);
  }

  const handleServiceHoursCacheUpdate = useCallback(
    (areaId: string, hours: LocationAreaServiceHour[]) => {
      setServiceHoursCache((prev) => ({ ...prev, [areaId]: hours }));
    },
    []
  );

  const handleStaffingCacheUpdate = useCallback(
    (areaId: string, staffing: LocationAreaStaffing[]) => {
      setStaffingCache((prev) => ({ ...prev, [areaId]: staffing }));
    },
    []
  );

  const refreshStaffingCache = useCallback(
    (locationId: string, areaId: string) => {
      void fetchLocationStaffingEditor(locationId, areaId).then((result) => {
        if (!result.ok) return;
        handleStaffingCacheUpdate(areaId, result.staffing ?? []);
      });
    },
    [handleStaffingCacheUpdate]
  );

  useEffect(() => {
    if (!selectedLocationId || !selectedAreaId) return;

    const areaId = selectedAreaId;
    const hoursReady = areaId in serviceHoursCache;
    const staffingReady = areaId in staffingCache;
    if (hoursReady && staffingReady) return;

    let cancelled = false;

    void Promise.all([
      hoursReady
        ? Promise.resolve(null)
        : fetchLocationAreaServiceHours(selectedLocationId, areaId),
      staffingReady
        ? Promise.resolve(null)
        : fetchLocationStaffingEditor(selectedLocationId, areaId),
    ]).then(([hoursResult, staffingResult]) => {
      if (cancelled) return;
      const hours =
        hoursResult?.ok === true ? (hoursResult.hours ?? []) : [];
      const staffing =
        staffingResult?.ok === true ? (staffingResult.staffing ?? []) : [];
      setServiceHoursCache((prev) => {
        if (areaId in prev) return prev;
        return { ...prev, [areaId]: hours };
      });
      setStaffingCache((prev) => {
        if (areaId in prev) return prev;
        return { ...prev, [areaId]: staffing };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    selectedLocationId,
    selectedAreaId,
    serviceHoursCache,
    staffingCache,
  ]);

  function selectLocation(id: string) {
    if (id === selectedLocationId) return;
    setSelectedLocationId(id);
    setAreas([]);
    setSelectedAreaId(null);
    setAreasLoading(true);
    setConfirmDeleteLocation(false);
    setConfirmDeleteArea(false);
    setDetailPanel(null);
    setErrorMessage(null);
  }

  function selectArea(id: string) {
    setSelectedAreaId(id);
    setConfirmDeleteArea(false);
    setDetailPanel(null);
    setErrorMessage(null);
  }

  function openEditLocation(location: Location) {
    setLocationFormMode({ type: "edit", location });
    setConfirmDeleteLocation(false);
    setDetailPanel(null);
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

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4",
        (pending || areasLoading) && "cursor-wait"
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !overlayFormOpen &&
          !confirmDeleteLocation &&
          !confirmDeleteArea
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
          aria-busy={pending || areasLoading}
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            overlayFormOpen ? "pointer-events-none" : "",
            (pending || areasLoading) && "[&_*]:cursor-wait"
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
            className="grid shrink-0 grid-cols-[minmax(0,calc(66%-10px))_minmax(0,calc(34%-10px))] items-stretch bg-background px-4 py-3"
            style={{ gap: COLUMN_GAP_PX }}
          >
            <div
              className="grid min-h-0 min-w-0 grid-cols-2 items-stretch"
              style={{ gap: COLUMN_GAP_PX }}
            >
              <ColumnShell
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
                          setDetailPanel(null);
                        }}
                      />
                    }
                    secondary={
                      <>
                        <ColumnActionButton
                          label={t("locations.edit")}
                          icon={<PencilIcon />}
                          disabled={pending || !selectedLocation}
                          onClick={() => {
                            if (!selectedLocation) return;
                            openEditLocation(selectedLocation);
                          }}
                        />
                        <SettingsReorderButtons
                          moveUpLabel={t("common.moveUp")}
                          moveDownLabel={t("common.moveDown")}
                          disabled={pending}
                          canMoveUp={canMoveLocationUp}
                          canMoveDown={canMoveLocationDown}
                          onMoveUp={() => {
                            setErrorMessage(null);
                            handleMoveLocation(-1);
                          }}
                          onMoveDown={() => {
                            setErrorMessage(null);
                            handleMoveLocation(1);
                          }}
                        />
                      </>
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
                    <tbody>
                      {sortedLocations.map((item) => {
                        const isSelected = item.id === selectedLocationId;
                        return (
                          <tr
                            key={item.id}
                            {...settingsListItemAttrs(item.id)}
                            onClick={() => selectLocation(item.id)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              window.getSelection()?.removeAllRanges();
                              openEditLocation(item);
                            }}
                            className={settingsDataRowClass(isSelected)}
                          >
                            <td
                              className={settingsIndicatorCellClass(isSelected)}
                              aria-hidden
                            />
                            <td
                              className={settingsDataCellClass(isSelected, {
                                className: "max-w-[8rem] truncate font-medium",
                              })}
                              title={item.name}
                            >
                              {truncateLabel(item.name)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </ColumnShell>

              <ColumnShell
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
                      <>
                        <ColumnActionButton
                          label={t("locations.areaEdit")}
                          icon={<PencilIcon />}
                          disabled={pending || !selectedArea}
                          onClick={() => {
                            if (!selectedArea) return;
                            openEditArea(selectedArea);
                          }}
                        />
                        <SettingsReorderButtons
                          moveUpLabel={t("common.moveUp")}
                          moveDownLabel={t("common.moveDown")}
                          disabled={pending || areasLoading || !selectedLocationId}
                          canMoveUp={canMoveAreaUp}
                          canMoveDown={canMoveAreaDown}
                          onMoveUp={() => {
                            setErrorMessage(null);
                            handleMoveArea(-1);
                          }}
                          onMoveDown={() => {
                            setErrorMessage(null);
                            handleMoveArea(1);
                          }}
                        />
                      </>
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
                    <tbody>
                      {sortedAreas.map((area) => {
                        const isSelected = area.id === selectedAreaId;
                        return (
                          <tr
                            key={area.id}
                            {...settingsListItemAttrs(area.id)}
                            onClick={() => selectArea(area.id)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              window.getSelection()?.removeAllRanges();
                              openEditArea(area);
                            }}
                            className={settingsDataRowClass(isSelected)}
                          >
                            <td
                              className={settingsIndicatorCellClass(isSelected)}
                              aria-hidden
                            />
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
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
              <h3 className={settingsPanelHeaderClass()}>
                {selectedArea
                  ? t("locations.panelSelected")
                  : t("locations.panelDetails")}
              </h3>
              {panelAreaReady && selectedArea ? (
                <LocationDetailActions
                  selectedLocation={selectedLocation ?? null}
                  selectedArea={selectedArea}
                  serviceHours={serviceHoursCache[selectedArea.id]}
                  staffing={staffingCache[selectedArea.id]}
                  disabled={pending || areasLoading}
                  onOpen={setDetailPanel}
                />
              ) : selectedAreaId ? (
                <div
                  className="min-h-0 flex-1"
                  aria-busy="true"
                  aria-label={t("common.loading")}
                />
              ) : (
                <LocationDetailActions
                  selectedLocation={selectedLocation ?? null}
                  selectedArea={null}
                  disabled={pending || areasLoading}
                  onOpen={setDetailPanel}
                />
              )}
            </div>
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
            onSaved={handleLocationFormSaved}
          />
        )}
        {locationFormMode?.type === "edit" && (
          <LocationFormModal
            mode="edit"
            location={locationFormMode.location}
            existingLocations={list}
            onClose={() => setLocationFormMode(null)}
            onSaved={handleLocationFormSaved}
          />
        )}
        {areaFormMode?.type === "create" && selectedLocationId && (
          <LocationAreaFormModal
            mode="create"
            locationId={selectedLocationId}
            existingAreas={areas}
            onClose={() => setAreaFormMode(null)}
            onSaved={handleAreaFormSaved}
          />
        )}
        {areaFormMode?.type === "edit" && selectedLocationId && (
          <LocationAreaFormModal
            mode="edit"
            locationId={selectedLocationId}
            area={areaFormMode.area}
            existingAreas={areas}
            onClose={() => setAreaFormMode(null)}
            onSaved={handleAreaFormSaved}
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
        {detailPanel === "serviceHours" && selectedLocation && selectedArea && (
          <LocationServiceHoursPanelModal
            location={selectedLocation}
            area={selectedArea}
            cachedHours={
              selectedArea.id in serviceHoursCache
                ? serviceHoursCache[selectedArea.id]
                : undefined
            }
            onClose={() => {
              setDetailPanel(null);
              refreshList();
            }}
            onCacheUpdate={handleServiceHoursCacheUpdate}
          />
        )}
        {detailPanel === "staffing" && selectedLocation && selectedArea && (
          <LocationStaffingPanelModal
            location={selectedLocation}
            area={selectedArea}
            onClose={() => {
              setDetailPanel(null);
              refreshStaffingCache(selectedLocation.id, selectedArea.id);
            }}
          />
        )}
      </div>
    </div>
  );
}
