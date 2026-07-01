"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  AreaQualificationTemplateEntry,
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
} from "@schichtwerk/types";
import { fetchAreaShiftTemplates } from "@/app/actions/area-shift-templates";
import { fetchAreaQualificationTemplates } from "@/app/actions/area-qualification-templates";
import { fetchLocationStaffingEditor } from "@/app/actions/location-staffing";
import { fetchLocationAreaServiceHours } from "@/app/actions/location-service-hours";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { LocationFormModal } from "./location-form-modal";
import { LocationAreaFormModal } from "./location-area-form-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { SettingsSidePanel, SettingsSidePanelCloseButton } from "./settings-side-panel";
import { SettingsDetailBackButton } from "./settings-detail-nav";
import { LocationDetailActions } from "./location-detail-actions";
import { areaPlanningModeLabel } from "./area-planning-mode-field";
import { LocationServiceHoursPanelModal } from "./location-service-hours-panel-modal";
import { LocationStaffingPanelModal } from "./location-staffing-panel-modal";
import { AreaShiftTemplatesPanelModal } from "./area-shift-templates-panel-modal";
import { AreaQualificationTemplatesPanelModal } from "./area-qualification-templates-panel-modal";
import {
  settingsMasterDetailLayoutClass,
  settingsMasterDetailListsClass,
  settingsModalFooterClass,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  SettingsListRowDeleteButton,
  applyCreatedListSelection,
  settingsListItemAttrs,
  useScrollToSettingsListItem,
  settingsListRowDeleteCellClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsPanelHeaderClass,
  PLANNING_SIDE_PANEL_SUBTITLE_CLASS,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";

type Props = {
  locations: Location[];
  onClose: () => void;
  initialSelectedLocationId?: string | null;
  initialAreas?: LocationArea[];
  initialSelectedAreaId?: string | null;
  /** Bereits geladene Detaildaten (Bereich-Kalender) — kein erneuter Fetch beim Öffnen */
  initialServiceHours?: LocationAreaServiceHour[];
  initialStaffing?: LocationAreaStaffing[];
  initialShiftTemplates?: AreaShiftTemplateWithBreaks[];
};

type LocationFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; location: Location };

type AreaFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; area: LocationArea };

type DetailPanel =
  | null
  | "qualificationTemplates"
  | "serviceHours"
  | "staffing"
  | "shiftTemplates";

function locationDetailPanelTitle(
  panel: Exclude<DetailPanel, null>,
  t: (key: string) => string
): string {
  switch (panel) {
    case "serviceHours":
      return t("locations.panelServiceHours");
    case "staffing":
      return t("locations.panelStaffing");
    case "shiftTemplates":
      return t("locations.panelShiftTemplates");
    case "qualificationTemplates":
      return t("locations.panelQualificationTemplates");
  }
}

const COLUMN_GAP_PX = 20;

/** Mindesthöhe der Listen — wächst mit der höheren Spalte (Standorte / Einsatzbereiche). */
const LOCATIONS_LIST_SCROLL_CLASS = "min-h-[calc(1.75rem+7rem)]";
const MAX_NAME_DISPLAY = 25;

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function filterByArea<T extends { location_area_id: string }>(
  items: T[],
  areaId: string
): T[] {
  return items.filter((item) => item.location_area_id === areaId);
}

function buildInitialDetailCaches(
  areaId: string,
  serviceHours: LocationAreaServiceHour[],
  staffing: LocationAreaStaffing[],
  shiftTemplates: AreaShiftTemplateWithBreaks[],
  qualificationTemplates?: AreaQualificationTemplateEntry[]
) {
  return {
    serviceHoursCache: { [areaId]: filterByArea(serviceHours, areaId) },
    staffingCache: { [areaId]: filterByArea(staffing, areaId) },
    shiftTemplatesCache: { [areaId]: filterByArea(shiftTemplates, areaId) },
    qualificationTemplatesCache:
      qualificationTemplates !== undefined
        ? { [areaId]: filterByArea(qualificationTemplates, areaId) }
        : {},
  };
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
      tooltip={title}
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
  listScrollClassName = LOCATIONS_LIST_SCROLL_CLASS,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  confirm?: ReactNode;
  listScrollClassName?: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
      <h3 className={settingsPanelHeaderClass()}>
        <span className="block min-w-0 w-full truncate">{title}</span>
      </h3>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-background px-2 py-2">
          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface",
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

function isAreaDetailCached(
  areaId: string,
  serviceHoursCache: Record<string, LocationAreaServiceHour[]>,
  staffingCache: Record<string, LocationAreaStaffing[]>,
  shiftTemplatesCache: Record<string, AreaShiftTemplateWithBreaks[]>,
  qualificationTemplatesCache: Record<string, AreaQualificationTemplateEntry[]>
): boolean {
  return (
    areaId in serviceHoursCache &&
    areaId in staffingCache &&
    areaId in shiftTemplatesCache &&
    areaId in qualificationTemplatesCache
  );
}

function isLocationsModalReady(
  locationId: string | null,
  areasLoading: boolean,
  selectedAreaId: string | null,
  displayedAreaId: string | null,
  serviceHoursCache: Record<string, LocationAreaServiceHour[]>,
  staffingCache: Record<string, LocationAreaStaffing[]>,
  shiftTemplatesCache: Record<string, AreaShiftTemplateWithBreaks[]>,
  qualificationTemplatesCache: Record<string, AreaQualificationTemplateEntry[]>
): boolean {
  if (!locationId) return true;
  if (areasLoading) return false;
  if (!selectedAreaId) return true;
  if (
    !isAreaDetailCached(
      selectedAreaId,
      serviceHoursCache,
      staffingCache,
      shiftTemplatesCache,
      qualificationTemplatesCache
    )
  ) {
    return false;
  }
  return displayedAreaId === selectedAreaId;
}

export function LocationsModal({
  locations,
  onClose,
  initialSelectedLocationId = null,
  initialAreas = [],
  initialSelectedAreaId = null,
  initialServiceHours,
  initialStaffing,
  initialShiftTemplates,
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
  const detailPrefetched =
    hasPrefetchedAreas &&
    !!initialSelectedAreaId &&
    initialServiceHours !== undefined &&
    initialStaffing !== undefined &&
    initialShiftTemplates !== undefined;
  const initialDetailCaches =
    detailPrefetched && initialSelectedAreaId
      ? buildInitialDetailCaches(
          initialSelectedAreaId,
          initialServiceHours,
          initialStaffing,
          initialShiftTemplates
        )
      : null;
  const skipInitialAreasFetch = useRef(hasPrefetchedAreas);

  const [pending, startTransition] = useTransition();
  const [hasInitiallyShown, setHasInitiallyShown] = useState(false);
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
  const [displayedLocationId, setDisplayedLocationId] = useState<string | null>(
    initialLocationId
  );
  const [displayedAreas, setDisplayedAreas] = useState<LocationArea[]>(() =>
    hasPrefetchedAreas ? initialAreas : []
  );
  const [displayedAreaId, setDisplayedAreaId] = useState<string | null>(() =>
    detailPrefetched ? (initialSelectedAreaId ?? null) : null
  );
  const [serviceHoursCache, setServiceHoursCache] = useState<
    Record<string, LocationAreaServiceHour[]>
  >(() => initialDetailCaches?.serviceHoursCache ?? {});
  const [staffingCache, setStaffingCache] = useState<
    Record<string, LocationAreaStaffing[]>
  >(() => initialDetailCaches?.staffingCache ?? {});
  const [shiftTemplatesCache, setShiftTemplatesCache] = useState<
    Record<string, AreaShiftTemplateWithBreaks[]>
  >(() => initialDetailCaches?.shiftTemplatesCache ?? {});
  const [qualificationTemplatesCache, setQualificationTemplatesCache] =
    useState<Record<string, AreaQualificationTemplateEntry[]>>(
      () => initialDetailCaches?.qualificationTemplatesCache ?? {}
    );

  const [locationFormMode, setLocationFormMode] = useState<LocationFormMode>(null);
  const [areaFormMode, setAreaFormMode] = useState<AreaFormMode>(null);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState(false);
  const [confirmDeleteArea, setConfirmDeleteArea] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToLocationId, setScrollToLocationId] = useState<string | null>(null);
  const [scrollToAreaId, setScrollToAreaId] = useState<string | null>(null);

  const overlayFormOpen = !!locationFormMode || !!areaFormMode;

  const anySubModalOpen =
    overlayFormOpen || confirmDeleteLocation || confirmDeleteArea;

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
  const displayedArea = displayedAreaId
    ? sortedAreas.find((a) => a.id === displayedAreaId)
    : undefined;
  const panelAreaReady =
    !!selectedAreaId &&
    isAreaDetailCached(
      selectedAreaId,
      serviceHoursCache,
      staffingCache,
      shiftTemplatesCache,
      qualificationTemplatesCache
    );
  const displayedPanelReady =
    !!displayedAreaId &&
    isAreaDetailCached(
      displayedAreaId,
      serviceHoursCache,
      staffingCache,
      shiftTemplatesCache,
      qualificationTemplatesCache
    );
  const modalReady = isLocationsModalReady(
    selectedLocationId,
    areasLoading,
    selectedAreaId,
    displayedAreaId,
    serviceHoursCache,
    staffingCache,
    shiftTemplatesCache,
    qualificationTemplatesCache
  );
  const deferInitialRender = !hasInitiallyShown && !modalReady;
  const locationDetailSwitching =
    !!selectedLocationId && selectedLocationId !== displayedLocationId;
  const areaDetailSwitching =
    !!selectedAreaId && selectedAreaId !== displayedAreaId;
  const detailContentSwitching = locationDetailSwitching || areaDetailSwitching;
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
  const areasPanelLocation =
    locationDetailSwitching && displayedLocationId
      ? sortedLocations.find((location) => location.id === displayedLocationId)
      : selectedLocation;
  const areasPanelTitle = areasPanelLocation
    ? t("locations.panelAreasOf", { location: areasPanelLocation.name })
    : t("locations.panelAreas");
  const areasForList = locationDetailSwitching ? displayedAreas : areas;
  const sortedAreasForList = useMemo(
    () => [...areasForList].sort((a, b) => a.sort_order - b.sort_order),
    [areasForList]
  );
  const areaListSelectedId = locationDetailSwitching
    ? displayedAreaId
    : selectedAreaId;
  const displayedLocation = displayedLocationId
    ? sortedLocations.find((location) => location.id === displayedLocationId)
    : undefined;

  const loadAreas = useCallback((locationId: string) => {
    startTransition(async () => {
      const result = await fetchLocationAreas(locationId);
      setAreasLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        setAreas([]);
        setSelectedAreaId(null);
        setDisplayedAreaId(null);
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
    if (modalReady && !hasInitiallyShown) {
      setHasInitiallyShown(true);
    }
  }, [hasInitiallyShown, modalReady]);

  useEffect(() => {
    if (!selectedAreaId) {
      setDisplayedAreaId(null);
      return;
    }
    if (!panelAreaReady) return;
    setDisplayedAreaId(selectedAreaId);
  }, [selectedAreaId, panelAreaReady]);

  useEffect(() => {
    if (!selectedLocationId) {
      setDisplayedLocationId(null);
      setDisplayedAreas([]);
      return;
    }
    if (areasLoading) return;
    if (!selectedAreaId) {
      if (areas.length === 0) {
        setDisplayedLocationId(selectedLocationId);
        setDisplayedAreas([]);
      }
      return;
    }
    if (!panelAreaReady || selectedAreaId !== displayedAreaId) return;
    setDisplayedLocationId(selectedLocationId);
    setDisplayedAreas(areas);
  }, [
    areas,
    areasLoading,
    displayedAreaId,
    panelAreaReady,
    selectedAreaId,
    selectedLocationId,
  ]);

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
      setDisplayedAreas([]);
      setSelectedAreaId(null);
      setDisplayedAreaId(null);
      setDisplayedLocationId(null);
      setAreasLoading(false);
      return;
    }
    if (skipInitialAreasFetch.current) {
      skipInitialAreasFetch.current = false;
      setDisplayedLocationId(selectedLocationId);
      return;
    }
    setConfirmDeleteArea(false);
    setDetailPanel(null);
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
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    areaFormMode,
    confirmDeleteArea,
    confirmDeleteLocation,
    detailPanel,
    locationFormMode,
  ]);

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
      setDisplayedAreaId(null);
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
    (
      areaId: string,
      staffing: LocationAreaStaffing[],
      serviceHours: LocationAreaServiceHour[]
    ) => {
      setStaffingCache((prev) => ({ ...prev, [areaId]: staffing }));
      setServiceHoursCache((prev) => ({ ...prev, [areaId]: serviceHours }));
    },
    []
  );

  const handleShiftTemplatesCacheUpdate = useCallback(
    (areaId: string, templates: AreaShiftTemplateWithBreaks[]) => {
      setShiftTemplatesCache((prev) => ({ ...prev, [areaId]: templates }));
    },
    []
  );

  const handleQualificationTemplatesCacheUpdate = useCallback(
    (areaId: string, templates: AreaQualificationTemplateEntry[]) => {
      setQualificationTemplatesCache((prev) => ({ ...prev, [areaId]: templates }));
    },
    []
  );

  const refreshStaffingCache = useCallback(
    (locationId: string, areaId: string) => {
      void fetchLocationStaffingEditor(locationId, areaId).then((result) => {
        if (!result.ok) return;
        handleStaffingCacheUpdate(
          areaId,
          result.staffing ?? [],
          result.serviceHours ?? []
        );
      });
    },
    [handleStaffingCacheUpdate]
  );

  useEffect(() => {
    if (!selectedLocationId || !selectedAreaId) return;

    const areaId = selectedAreaId;
    const hoursReady = areaId in serviceHoursCache;
    const staffingReady = areaId in staffingCache;
    const templatesReady = areaId in shiftTemplatesCache;
    const qualificationTemplatesReady = areaId in qualificationTemplatesCache;
    if (
      hoursReady &&
      staffingReady &&
      templatesReady &&
      qualificationTemplatesReady
    ) {
      setDisplayedAreaId((current) => current ?? areaId);
      return;
    }

    let cancelled = false;

    void Promise.all([
      hoursReady
        ? Promise.resolve(null)
        : fetchLocationAreaServiceHours(selectedLocationId, areaId),
      staffingReady
        ? Promise.resolve(null)
        : fetchLocationStaffingEditor(selectedLocationId, areaId),
      templatesReady
        ? Promise.resolve(null)
        : fetchAreaShiftTemplates(selectedLocationId, areaId),
      qualificationTemplatesReady
        ? Promise.resolve(null)
        : fetchAreaQualificationTemplates(selectedLocationId, areaId),
    ])
      .then(([hoursResult, staffingResult, templatesResult, qualificationResult]) => {
        if (cancelled) return;
        const hours =
          hoursResult?.ok === true ? (hoursResult.hours ?? []) : [];
        const staffing =
          staffingResult?.ok === true ? (staffingResult.staffing ?? []) : [];
        const templates =
          templatesResult?.ok === true ? (templatesResult.templates ?? []) : [];
        const qualificationTemplates =
          qualificationResult?.ok === true
            ? (qualificationResult.templates ?? [])
            : [];
        setServiceHoursCache((prev) => {
          if (areaId in prev) return prev;
          return { ...prev, [areaId]: hours };
        });
        setStaffingCache((prev) => {
          if (areaId in prev) return prev;
          return { ...prev, [areaId]: staffing };
        });
        setShiftTemplatesCache((prev) => {
          if (areaId in prev) return prev;
          return { ...prev, [areaId]: templates };
        });
        setQualificationTemplatesCache((prev) => {
          if (areaId in prev) return prev;
          return { ...prev, [areaId]: qualificationTemplates };
        });
        setDisplayedAreaId(areaId);
      })
      .catch(() => {
        if (cancelled) return;
        setServiceHoursCache((prev) =>
          areaId in prev ? prev : { ...prev, [areaId]: [] }
        );
        setStaffingCache((prev) =>
          areaId in prev ? prev : { ...prev, [areaId]: [] }
        );
        setShiftTemplatesCache((prev) =>
          areaId in prev ? prev : { ...prev, [areaId]: [] }
        );
        setQualificationTemplatesCache((prev) =>
          areaId in prev ? prev : { ...prev, [areaId]: [] }
        );
        setDisplayedAreaId(areaId);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedLocationId,
    selectedAreaId,
    serviceHoursCache,
    staffingCache,
    shiftTemplatesCache,
    qualificationTemplatesCache,
  ]);

  function selectLocation(id: string) {
    if (id === selectedLocationId) return;
    setSelectedLocationId(id);
    setAreasLoading(true);
    setConfirmDeleteLocation(false);
    setConfirmDeleteArea(false);
    setDetailPanel(null);
    setErrorMessage(null);
  }

  function selectArea(id: string) {
    if (id === selectedAreaId) return;
    setSelectedAreaId(id);
    if (
      isAreaDetailCached(
        id,
        serviceHoursCache,
        staffingCache,
        shiftTemplatesCache,
        qualificationTemplatesCache
      )
    ) {
      setDisplayedAreaId(id);
    }
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
      setDisplayedAreas(result.areas ?? []);
      setDisplayedAreaId(null);
      setSelectedAreaId(result.areas?.[0]?.id ?? null);
      setConfirmDeleteArea(false);
      refreshList();
    });
  }

  useEffect(() => {
    if (!deferInitialRender && !detailContentSwitching) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [deferInitialRender, detailContentSwitching]);

  const detailContextSubtitle =
    detailPanel && selectedLocation && selectedArea
      ? `${selectedLocation.name} · ${selectedArea.name}`
      : undefined;

  const detailSubtitleNode =
    detailPanel && selectedLocation && selectedArea ? (
      <div className={PLANNING_SIDE_PANEL_SUBTITLE_CLASS}>
        <p className="break-words">{detailContextSubtitle}</p>
        {detailPanel === "qualificationTemplates" ? (
          <p className="mt-1 text-xs">{t("locations.areaQualificationTemplatesHint")}</p>
        ) : null}
        {detailPanel === "shiftTemplates" ? (
          <p className="mt-1 text-xs">{t("locations.areaShiftTemplatesHint")}</p>
        ) : null}
      </div>
    ) : undefined;

  function navigateBackFromDetail() {
    setDetailPanel(null);
  }

  return (
    <SettingsSidePanel
      title={
        detailPanel
          ? locationDetailPanelTitle(detailPanel, t)
          : t("locations.title")
      }
      subtitle={detailPanel ? undefined : undefined}
      subtitleNode={detailSubtitleNode}
      titleId="locations-modal-title"
      onClose={onClose}
      closeDisabled={pending}
      dismissOnBackdrop={!anySubModalOpen && !detailPanel}
      dismissOnEscape={!anySubModalOpen && !detailPanel}
      closeAriaLabel={t("common.close")}
      contentReady={!deferInitialRender}
      panelClassName={cn(
        (pending ||
          areasLoading ||
          detailContentSwitching ||
          deferInitialRender) &&
          "cursor-wait [&_*]:cursor-wait",
        anySubModalOpen && "pointer-events-none"
      )}
      bodyClassName={cn(
        detailPanel ? "flex min-h-0 flex-col px-0 py-0" : undefined
      )}
      headerAside={
        detailPanel ? (
          <SettingsDetailBackButton
            label={t("locations.title")}
            onClick={() => setDetailPanel(null)}
            disabled={pending || areasLoading || detailContentSwitching}
          />
        ) : undefined
      }
      footer={
        !detailPanel ? (
          <div className={settingsModalFooterClass()}>
            <SettingsSidePanelCloseButton disabled={pending} />
          </div>
        ) : undefined
      }
      overlay={
        <>
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
              onServiceHoursUpdated={(areaId) => {
                void fetchLocationAreaServiceHours(selectedLocationId, areaId).then(
                  (result) => {
                    if (!result.ok) return;
                    handleServiceHoursCacheUpdate(areaId, result.hours ?? []);
                  }
                );
              }}
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
        </>
      }
    >
      {errorMessage && (
        <div className="mb-4 shrink-0">
          <Alert variant="error">{errorMessage}</Alert>
        </div>
      )}

      {detailPanel && selectedLocation && selectedArea ? (
        <>
          {detailPanel === "serviceHours" && (
            <LocationServiceHoursPanelModal
              embedded
              location={selectedLocation}
              area={selectedArea}
              cachedHours={
                selectedArea.id in serviceHoursCache
                  ? serviceHoursCache[selectedArea.id]
                  : undefined
              }
              cachedShiftTemplates={
                selectedArea.id in shiftTemplatesCache
                  ? shiftTemplatesCache[selectedArea.id]
                  : undefined
              }
              onClose={navigateBackFromDetail}
              onCacheUpdate={handleServiceHoursCacheUpdate}
              onShiftTemplatesCacheUpdate={handleShiftTemplatesCacheUpdate}
            />
          )}
          {detailPanel === "staffing" && (
            <LocationStaffingPanelModal
              embedded
              location={selectedLocation}
              area={selectedArea}
              cachedServiceHours={
                selectedArea.id in serviceHoursCache
                  ? serviceHoursCache[selectedArea.id]
                  : undefined
              }
              cachedStaffing={
                selectedArea.id in staffingCache
                  ? staffingCache[selectedArea.id]
                  : undefined
              }
              cachedShiftTemplates={
                selectedArea.id in shiftTemplatesCache
                  ? shiftTemplatesCache[selectedArea.id]
                  : undefined
              }
              onClose={navigateBackFromDetail}
              onCacheUpdate={handleStaffingCacheUpdate}
              onShiftTemplatesCacheUpdate={handleShiftTemplatesCacheUpdate}
            />
          )}
          {detailPanel === "shiftTemplates" && (
            <AreaShiftTemplatesPanelModal
              embedded
              location={selectedLocation}
              area={selectedArea}
              onClose={navigateBackFromDetail}
              onCacheUpdate={handleShiftTemplatesCacheUpdate}
            />
          )}
          {detailPanel === "qualificationTemplates" && (
            <AreaQualificationTemplatesPanelModal
              embedded
              location={selectedLocation}
              area={selectedArea}
              onClose={navigateBackFromDetail}
              onCacheUpdate={handleQualificationTemplatesCacheUpdate}
            />
          )}
        </>
      ) : (
        <div
          className={settingsMasterDetailLayoutClass("min-h-0 lg:items-stretch")}
          style={{ gap: COLUMN_GAP_PX }}
        >
            <div
              className={settingsMasterDetailListsClass("h-full min-h-0")}
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
                            >
                              <span className="block max-w-full truncate">
                                {truncateLabel(item.name)}
                              </span>
                            </td>
                            <td className={settingsListRowDeleteCellClass(isSelected)}>
                              <SettingsListRowDeleteButton
                                label={t("locations.delete")}
                                disabled={pending}
                                showTooltip={false}
                                onClick={() => {
                                  selectLocation(item.id);
                                  setConfirmDeleteLocation(true);
                                  setErrorMessage(null);
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </ColumnShell>

            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col",
                locationDetailSwitching && "pointer-events-none"
              )}
            >
              <ColumnShell
                title={areasPanelTitle}
                actions={
                  <SettingsActionBar
                    primary={
                      <ColumnPrimaryButton
                        label={t("locations.areaNew")}
                        icon={<PlusIcon />}
                        disabled={pending || !selectedLocationId || detailContentSwitching}
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
                          disabled={
                            pending || detailContentSwitching || !selectedArea
                          }
                          onClick={() => {
                            if (!selectedArea) return;
                            openEditArea(selectedArea);
                          }}
                        />
                        <SettingsReorderButtons
                          moveUpLabel={t("common.moveUp")}
                          moveDownLabel={t("common.moveDown")}
                          disabled={
                            pending ||
                            areasLoading ||
                            detailContentSwitching ||
                            !selectedLocationId
                          }
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
                  />
                }
              >
                {!selectedLocationId ? (
                  <SettingsEmptyState message={t("locations.areasNoLocation")} />
                ) : areasLoading && sortedAreasForList.length === 0 ? (
                  <SettingsEmptyState message={t("common.loading")} />
                ) : sortedAreasForList.length === 0 ? (
                  <SettingsEmptyState
                    message={t("locations.areasEmpty")}
                    hint={t("common.emptyHintCreate")}
                  />
                ) : (
                  <table className="w-full border-collapse">
                    <tbody>
                      {sortedAreasForList.map((area) => {
                        const isSelected = area.id === areaListSelectedId;
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
                            >
                              <span className="block max-w-full truncate">
                                {truncateLabel(area.name)}
                              </span>
                            </td>
                            <td className={settingsListRowDeleteCellClass(isSelected)}>
                              <SettingsListRowDeleteButton
                                label={t("locations.areaDelete")}
                                disabled={pending || detailContentSwitching}
                                showTooltip={false}
                                onClick={() => {
                                  selectArea(area.id);
                                  setConfirmDeleteArea(true);
                                  setErrorMessage(null);
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </ColumnShell>
            </div>
            </div>

            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60",
                detailContentSwitching && "pointer-events-none"
              )}
            >
              <h3 className={settingsPanelHeaderClass()}>
                {displayedArea ? (
                  <Tooltip
                    content={displayedArea.name}
                    className="block min-w-0 w-full truncate"
                  >
                    <span className="block truncate">
                      {t("locations.panelSelected")}: {displayedArea.name}{" "}
                      <span className="text-xs font-normal text-muted">
                        {areaPlanningModeLabel(displayedArea.planning_mode, t)}
                      </span>
                    </span>
                  </Tooltip>
                ) : (
                  t("locations.panelDetails")
                )}
              </h3>
              {displayedArea && displayedPanelReady ? (
                <LocationDetailActions
                  selectedLocation={displayedLocation ?? selectedLocation ?? null}
                  selectedArea={displayedArea}
                  serviceHours={serviceHoursCache[displayedArea.id]}
                  staffing={staffingCache[displayedArea.id]}
                  shiftTemplates={shiftTemplatesCache[displayedArea.id]}
                  qualificationTemplates={
                    qualificationTemplatesCache[displayedArea.id]
                  }
                  disabled={pending || areasLoading || detailContentSwitching}
                  onOpen={setDetailPanel}
                />
              ) : (
                <LocationDetailActions
                  selectedLocation={displayedLocation ?? selectedLocation ?? null}
                  selectedArea={null}
                  disabled={pending || areasLoading || detailContentSwitching}
                  onOpen={setDetailPanel}
                />
              )}
            </div>
          </div>
      )}
    </SettingsSidePanel>
  );
}
