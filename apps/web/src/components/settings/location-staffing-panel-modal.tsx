"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  deleteShiftTypeStaffing,
  fetchLocationStaffingEditor,
} from "@/app/actions/location-staffing";
import { fetchLocationAreaServiceHours } from "@/app/actions/location-service-hours";
import type {
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Qualification,
  ShiftType,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import { useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import {
  LocationAreaStaffingMatrix,
  type LocationAreaStaffingMatrixHandle,
} from "./location-area-staffing-matrix";
import { LocationStaffingDetailPanelModal } from "./location-staffing-detail-panel-modal";
import {
  SETTINGS_LIST_SCROLL_COMPACT_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  applyCreatedListSelection,
  useScrollToSettingsListItem,
} from "@/lib/settings-list-scroll";

type StaffingFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; shiftTypeId: string };

type Props = {
  location: Location;
  area: LocationArea;
  onClose: () => void;
};

type StaffingEditorData = {
  shiftTypes: ShiftType[];
  qualifications: Qualification[];
  staffing: LocationAreaStaffing[];
};

const STAFFING_CONTENT_EMPTY_STATE_CLASS = "min-h-full";

export function LocationStaffingPanelModal({ location, area, onClose }: Props) {
  const t = useTranslations();
  const staffingRef = useRef<LocationAreaStaffingMatrixHandle>(null);
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serviceHours, setServiceHours] = useState<AreaServiceHourRef[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [staffingFormMode, setStaffingFormMode] = useState<StaffingFormMode>(null);
  const [confirmDeleteStaffing, setConfirmDeleteStaffing] = useState(false);
  const [selectedStaffingShiftTypeId, setSelectedStaffingShiftTypeId] =
    useState<string | null>(null);
  const [staffingEditorData, setStaffingEditorData] =
    useState<StaffingEditorData | null>(null);
  const [scrollToStaffingId, setScrollToStaffingId] = useState<string | null>(
    null
  );

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
  const selectedStaffingShiftType =
    staffingEditorData?.shiftTypes.find(
      (type) => type.id === selectedStaffingShiftTypeId
    ) ?? null;
  const anyOverlayOpen = !!staffingFormMode || confirmDeleteStaffing;
  const listsLoading = initialLoading || reloading;
  const configuredShiftTypesForScroll = useMemo(
    () =>
      (staffingEditorData?.shiftTypes ?? []).filter((type) =>
        configuredStaffingShiftTypeIds.has(type.id)
      ),
    [staffingEditorData, configuredStaffingShiftTypeIds]
  );

  useScrollToSettingsListItem(
    configuredShiftTypesForScroll,
    scrollToStaffingId,
    () => setScrollToStaffingId(null)
  );

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setReloading(false);
    setErrorMessage(null);
    setStaffingEditorData(null);
    setSelectedStaffingShiftTypeId(null);

    void Promise.all([
      fetchLocationAreaServiceHours(location.id, area.id),
      fetchLocationStaffingEditor(location.id, area.id),
    ]).then(([hoursResult, editorResult]) => {
      if (cancelled) return;

      if (!hoursResult.ok) {
        setErrorMessage(hoursResult.error);
        setServiceHours([]);
      } else {
        setServiceHours(
          (hoursResult.hours ?? []).map((h: LocationAreaServiceHour) => ({
            location_area_id: h.location_area_id,
            weekday: h.weekday,
          }))
        );
      }

      if (!editorResult.ok) {
        setErrorMessage((current) => current ?? editorResult.error);
        setStaffingEditorData({
          shiftTypes: [],
          qualifications: [],
          staffing: [],
        });
      } else {
        setStaffingEditorData({
          shiftTypes: editorResult.shiftTypes ?? [],
          qualifications: editorResult.qualifications ?? [],
          staffing: editorResult.staffing ?? [],
        });
      }

      setInitialLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [location.id, area.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
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
  }, [confirmDeleteStaffing, staffingFormMode, onClose]);

  function handleStaffingSaved(
    createdShiftTypeId?: string,
    staffing?: LocationAreaStaffing[]
  ) {
    if (createdShiftTypeId) {
      applyCreatedListSelection(
        createdShiftTypeId,
        (id) => setSelectedStaffingShiftTypeId(id),
        setScrollToStaffingId
      );
    }
    if (staffing !== undefined) {
      setStaffingEditorData((prev) =>
        prev ? { ...prev, staffing } : prev
      );
      staffingRef.current?.applyStaffing(staffing);
      return;
    }
    staffingRef.current?.reload();
  }

  function handleDeleteStaffing() {
    if (!selectedStaffingShiftTypeId) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteShiftTypeStaffing({
        locationId: location.id,
        locationAreaId: area.id,
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
        "absolute inset-0 z-[60] flex items-center justify-center rounded-2xl bg-black/30 p-4",
        listsLoading && "cursor-wait"
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !anyOverlayOpen) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-staffing-panel-title"
        aria-busy={listsLoading || pending}
        aria-hidden={anyOverlayOpen}
        className={cn(
          "relative z-[61] flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          listsLoading && "[&_*]:cursor-wait",
          anyOverlayOpen ? "pointer-events-none" : ""
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="location-staffing-panel-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {t("locations.panelStaffingOf", {
              location: location.name,
              area: area.name,
            })}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={pending}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        {errorMessage && (
          <div className="mx-4 mt-3 shrink-0">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden px-4 py-3",
            SETTINGS_LIST_SCROLL_COMPACT_CLASS
          )}
        >
          {initialLoading || !staffingEditorData ? (
            <SettingsEmptyState
              message={t("common.loading")}
              className={STAFFING_CONTENT_EMPTY_STATE_CLASS}
            />
          ) : (
            <LocationAreaStaffingMatrix
              ref={staffingRef}
              embedded
              locationId={location.id}
              area={area}
              serviceHours={serviceHours}
              initialEditorData={staffingEditorData}
              selectedShiftTypeId={selectedStaffingShiftTypeId}
              onSelectShiftType={setSelectedStaffingShiftTypeId}
              onEditShiftType={(shiftTypeId) => {
                if (pending || listsLoading) return;
                setStaffingFormMode({ type: "edit", shiftTypeId });
                setConfirmDeleteStaffing(false);
                setErrorMessage(null);
              }}
              onDataLoaded={setStaffingEditorData}
              onLoadingChange={setReloading}
            />
          )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <SettingsActionBar
            primary={
              <SettingsPrimaryActionButton
                label={t("locations.new")}
                icon={<PlusIcon />}
                disabled={
                  pending || listsLoading || !hasUnassignedShiftTypes
                }
                onClick={() => {
                  setStaffingFormMode({ type: "create" });
                  setConfirmDeleteStaffing(false);
                  setErrorMessage(null);
                }}
              />
            }
            secondary={
              <SettingsIconActionButton
                label={t("locations.edit")}
                icon={<PencilIcon />}
                disabled={pending || listsLoading || !selectedStaffingShiftTypeId}
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
              <SettingsIconActionButton
                label={t("locations.delete")}
                icon={<TrashIcon />}
                disabled={pending || listsLoading || !selectedStaffingShiftTypeId}
                onClick={() => {
                  setConfirmDeleteStaffing(true);
                  setErrorMessage(null);
                }}
              />
            }
          />
        </div>

        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
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

      {staffingFormMode && staffingEditorData && (
        <LocationStaffingDetailPanelModal
          key={
            staffingFormMode.type === "edit"
              ? `edit-${staffingFormMode.shiftTypeId}`
              : "create"
          }
          mode={staffingFormMode.type}
          location={location}
          area={area}
          serviceHours={serviceHours}
          shiftTypes={staffingEditorData.shiftTypes}
          qualifications={staffingEditorData.qualifications}
          staffing={staffingEditorData.staffing}
          initialShiftTypeId={
            staffingFormMode.type === "edit"
              ? staffingFormMode.shiftTypeId
              : undefined
          }
          onClose={() => setStaffingFormMode(null)}
          onSaved={(createdShiftTypeId, staffing) => {
            setStaffingFormMode(null);
            handleStaffingSaved(createdShiftTypeId, staffing);
          }}
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
    </div>
  );
}
