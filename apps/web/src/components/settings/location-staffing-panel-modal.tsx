"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  deleteServiceHourStaffing,
  fetchLocationStaffingEditor,
} from "@/app/actions/location-staffing";
import type {
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";
import {
  formatServiceHourStaffingListLabel,
  weekdayLabelFromIndex,
} from "@/lib/location-staffing-client";
import { fetchAreaShiftTemplates } from "@/app/actions/area-shift-templates";
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
  settingsModalFooterClass,
  settingsScrollableTableListClass,
  settingsModalHeaderPaddingClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
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
  | { type: "edit"; serviceHourId: string };

type Props = {
  location: Location;
  area: LocationArea;
  onClose: () => void;
};

type StaffingEditorData = {
  serviceHours: LocationAreaServiceHour[];
  qualifications: Qualification[];
  staffing: LocationAreaStaffing[];
  shiftTemplates: AreaShiftTemplateWithBreaks[];
};

const STAFFING_CONTENT_EMPTY_STATE_CLASS = "min-h-full";

export function LocationStaffingPanelModal({ location, area, onClose }: Props) {
  const t = useTranslations();
  const staffingRef = useRef<LocationAreaStaffingMatrixHandle>(null);
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [staffingFormMode, setStaffingFormMode] = useState<StaffingFormMode>(null);
  const [confirmDeleteStaffing, setConfirmDeleteStaffing] = useState(false);
  const [selectedServiceHourId, setSelectedServiceHourId] = useState<string | null>(
    null
  );
  const [staffingEditorData, setStaffingEditorData] =
    useState<StaffingEditorData | null>(null);
  const [scrollToStaffingId, setScrollToStaffingId] = useState<string | null>(
    null
  );

  const configuredServiceHourIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rule of staffingEditorData?.staffing ?? []) {
      if (rule.required_count > 0) ids.add(rule.service_hour_id);
    }
    return ids;
  }, [staffingEditorData]);

  const selectedServiceHour =
    staffingEditorData?.serviceHours.find(
      (hour) => hour.id === selectedServiceHourId
    ) ?? null;

  const selectedServiceHourLabel = selectedServiceHour
    ? formatServiceHourStaffingListLabel(
        selectedServiceHour,
        (weekday) => weekdayLabelFromIndex(weekday, t),
        staffingEditorData?.shiftTemplates
      )
    : "";

  const anyOverlayOpen = !!staffingFormMode || confirmDeleteStaffing;
  const listsLoading = initialLoading || reloading;

  const configuredServiceHoursForScroll = useMemo(
    () =>
      (staffingEditorData?.serviceHours ?? []).filter((hour) =>
        configuredServiceHourIds.has(hour.id)
      ),
    [staffingEditorData, configuredServiceHourIds]
  );

  useScrollToSettingsListItem(
    configuredServiceHoursForScroll,
    scrollToStaffingId,
    () => setScrollToStaffingId(null)
  );

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setReloading(false);
    setErrorMessage(null);
    setStaffingEditorData(null);
    setSelectedServiceHourId(null);

    void Promise.all([
      fetchLocationStaffingEditor(location.id, area.id),
      fetchAreaShiftTemplates(location.id, area.id),
    ]).then(([editorResult, templatesResult]) => {
      if (cancelled) return;

      const shiftTemplates =
        templatesResult.ok === true ? (templatesResult.templates ?? []) : [];

      if (!editorResult.ok) {
        setErrorMessage(editorResult.error);
        setStaffingEditorData({
          serviceHours: [],
          qualifications: [],
          staffing: [],
          shiftTemplates,
        });
      } else {
        setStaffingEditorData({
          serviceHours: editorResult.serviceHours ?? [],
          qualifications: editorResult.qualifications ?? [],
          staffing: editorResult.staffing ?? [],
          shiftTemplates,
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
    createdServiceHourId?: string,
    staffing?: LocationAreaStaffing[],
    serviceHours?: LocationAreaServiceHour[]
  ) {
    if (createdServiceHourId) {
      applyCreatedListSelection(
        createdServiceHourId,
        (id) => setSelectedServiceHourId(id),
        setScrollToStaffingId
      );
    }
    if (staffing !== undefined) {
      setStaffingEditorData((prev) =>
        prev
          ? {
              ...prev,
              staffing,
              ...(serviceHours !== undefined ? { serviceHours } : {}),
            }
          : prev
      );
      staffingRef.current?.applyStaffing(staffing, serviceHours);
      return;
    }
    staffingRef.current?.reload();
  }

  function handleDeleteStaffing() {
    if (!selectedServiceHourId) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteServiceHourStaffing({
        locationId: location.id,
        serviceHourId: selectedServiceHourId,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDeleteStaffing(false);
        return;
      }
      setConfirmDeleteStaffing(false);
      setSelectedServiceHourId(null);
      handleStaffingSaved(undefined, result.staffing);
    });
  }

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), listsLoading && "cursor-wait")}
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
          settingsSubModalDialogClass("2xl"),
          listsLoading && "[&_*]:cursor-wait",
          anyOverlayOpen ? "pointer-events-none" : ""
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
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

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
          {initialLoading || !staffingEditorData ? (
            <SettingsEmptyState
              message={t("common.loading")}
              className={STAFFING_CONTENT_EMPTY_STATE_CLASS}
            />
          ) : (
            <LocationAreaStaffingMatrix
              ref={staffingRef}
              embedded
              listScrollClassName={cn(
                settingsScrollableTableListClass(),
                SETTINGS_LIST_SCROLL_COMPACT_CLASS
              )}
              locationId={location.id}
              area={area}
              initialEditorData={staffingEditorData}
              selectedServiceHourId={selectedServiceHourId}
              onSelectServiceHour={setSelectedServiceHourId}
              onEditServiceHour={(serviceHourId) => {
                if (pending || listsLoading) return;
                setStaffingFormMode({ type: "edit", serviceHourId });
                setConfirmDeleteStaffing(false);
                setErrorMessage(null);
              }}
              onDataLoaded={(data) => {
                setStaffingEditorData((prev) =>
                  prev
                    ? {
                        ...prev,
                        ...data,
                        shiftTemplates: prev.shiftTemplates,
                      }
                    : { ...data, shiftTemplates: [] }
                );
              }}
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
                  pending ||
                  listsLoading ||
                  !(staffingEditorData?.qualifications.length ?? 0)
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
                disabled={pending || listsLoading || !selectedServiceHourId}
                onClick={() => {
                  if (!selectedServiceHourId) return;
                  setStaffingFormMode({
                    type: "edit",
                    serviceHourId: selectedServiceHourId,
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
                disabled={pending || listsLoading || !selectedServiceHourId}
                onClick={() => {
                  setConfirmDeleteStaffing(true);
                  setErrorMessage(null);
                }}
              />
            }
          />
        </div>

        <div className={settingsModalFooterClass("shrink-0")}>
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
              ? `edit-${staffingFormMode.serviceHourId}`
              : "create"
          }
          mode={staffingFormMode.type}
          location={location}
          area={area}
          serviceHours={staffingEditorData.serviceHours}
          shiftTemplates={staffingEditorData.shiftTemplates}
          qualifications={staffingEditorData.qualifications}
          staffing={staffingEditorData.staffing}
          initialServiceHourId={
            staffingFormMode.type === "edit"
              ? staffingFormMode.serviceHourId
              : undefined
          }
          onClose={() => setStaffingFormMode(null)}
          onSaved={(createdServiceHourId, staffing, serviceHours) => {
            setStaffingFormMode(null);
            handleStaffingSaved(createdServiceHourId, staffing, serviceHours);
          }}
        />
      )}
      {confirmDeleteStaffing && selectedServiceHourLabel && (
        <DeleteConfirmModal
          name={selectedServiceHourLabel}
          pending={pending}
          onCancel={() => setConfirmDeleteStaffing(false)}
          onConfirm={handleDeleteStaffing}
        />
      )}
    </div>
  );
}
