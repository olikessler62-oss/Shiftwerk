"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  copyLocationStaffingFromArea,
  deleteServiceHourStaffing,
  fetchLocationStaffingEditor,
  fetchLocationStaffingSources,
  type StaffingSourceArea,
} from "@/app/actions/location-staffing";
import { fetchAreaShiftTemplates } from "@/app/actions/area-shift-templates";
import type {
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
} from "@schichtwerk/types";
import { locationAreaStaffingSetsEqual } from "@/lib/location-area-copy-compare";
import {
  formatServiceHourStaffingListLabel,
  weekdayLabelFromIndex,
} from "@/lib/location-staffing-client";
import { useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import {
  LocationAreaStaffingMatrix,
  type LocationAreaStaffingMatrixHandle,
  type StaffingEditorData,
} from "./location-area-staffing-matrix";
import { LocationStaffingDetailPanelModal } from "./location-staffing-detail-panel-modal";
import {
  SETTINGS_STAFFING_PANEL_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  applyCreatedListSelection,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  useScrollToSettingsListItem,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  location: Location;
  area: LocationArea;
  onClose: () => void;
};

type FormMode = null | "create" | "edit";

export function LocationStaffingPanelModal({ location, area, onClose }: Props) {
  const t = useTranslations();
  const matrixRef = useRef<LocationAreaStaffingMatrixHandle>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<StaffingEditorData | null>(null);
  const [selectedServiceHourId, setSelectedServiceHourId] = useState<string | null>(
    null
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [sourceAreas, setSourceAreas] = useState<StaffingSourceArea[]>([]);
  const [selectedSourceAreaId, setSelectedSourceAreaId] = useState("");

  const applyEditorData = useCallback((data: StaffingEditorData) => {
    setEditorData(data);
    matrixRef.current?.applyStaffing(data.staffing, data.serviceHours);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    setEditorData(null);
    setSelectedServiceHourId(null);
    setFormMode(null);
    setConfirmDeleteId(null);

    void Promise.all([
      fetchLocationStaffingEditor(location.id, area.id),
      fetchAreaShiftTemplates(location.id, area.id),
    ]).then(([editorResult, templatesResult]) => {
      if (cancelled) return;

      const shiftTemplates =
        templatesResult.ok === true ? (templatesResult.templates ?? []) : [];

      if (!editorResult.ok) {
        setErrorMessage(editorResult.error);
        setEditorData({
          serviceHours: [],
          qualifications: [],
          staffing: [],
          shiftTemplates,
        });
      } else {
        setEditorData({
          serviceHours: editorResult.serviceHours ?? [],
          qualifications: editorResult.qualifications ?? [],
          staffing: editorResult.staffing ?? [],
          shiftTemplates,
        });
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [location.id, area.id]);

  useEffect(() => {
    let cancelled = false;
    void fetchLocationStaffingSources(location.id, area.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) return;
      const sources = result.sources ?? [];
      setSourceAreas(sources);
      setSelectedSourceAreaId(sources[0]?.id ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [location.id, area.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || deleting || pending) return;
      if (formMode) {
        setFormMode(null);
        return;
      }
      if (confirmDeleteId) {
        setConfirmDeleteId(null);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, deleting, formMode, onClose, pending]);

  const configuredServiceHours = (editorData?.serviceHours ?? []).filter((hour) =>
    (editorData?.staffing ?? []).some(
      (rule) => rule.service_hour_id === hour.id && rule.required_count > 0
    )
  );

  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(
    configuredServiceHours.map((hour) => ({ id: hour.id })),
    scrollToItemId,
    clearScrollTarget
  );

  const selectedSourceArea = sourceAreas.find(
    (entry) => entry.id === selectedSourceAreaId
  );

  const copySourceSelectStyle = useMemo(() => {
    const longestChars = sourceAreas.reduce(
      (max, entry) => Math.max(max, entry.name.length),
      0
    );
    return {
      width: `calc(${Math.max(longestChars, 4)}ch + 2.25rem)`,
      maxWidth: "100%",
    };
  }, [sourceAreas]);

  const copyFromSourceIsNoOp = useMemo(() => {
    if (!selectedSourceArea || !editorData) return true;
    return locationAreaStaffingSetsEqual(
      editorData.serviceHours,
      editorData.staffing,
      editorData.qualifications,
      selectedSourceArea.serviceHours,
      selectedSourceArea.staffing
    );
  }, [editorData, selectedSourceArea]);

  const deleteTargetHour = confirmDeleteId
    ? editorData?.serviceHours.find((hour) => hour.id === confirmDeleteId)
    : undefined;

  const deleteTargetLabel =
    deleteTargetHour && editorData
      ? formatServiceHourStaffingListLabel(
          deleteTargetHour,
          (weekday) => weekdayLabelFromIndex(weekday, t),
          editorData.shiftTemplates ?? []
        )
      : "";

  const anyOverlayOpen = formMode !== null || confirmDeleteId !== null;
  const hasQualifications = (editorData?.qualifications.length ?? 0) > 0;
  const busy = loading || deleting || pending;

  function handleSaved(
    serviceHourId?: string,
    staffing?: LocationAreaStaffing[],
    serviceHours?: LocationAreaServiceHour[]
  ) {
    if (staffing && serviceHours && editorData) {
      const nextData: StaffingEditorData = {
        ...editorData,
        staffing,
        serviceHours,
      };
      applyEditorData(nextData);
    }

    if (serviceHourId) {
      applyCreatedListSelection(serviceHourId, setSelectedServiceHourId, setScrollToItemId);
    }

    setFormMode(null);
  }

  function handleCopyFromSourceArea() {
    if (!selectedSourceArea) return;
    setErrorMessage(null);
    setConfirmDeleteId(null);
    setFormMode(null);
    startTransition(async () => {
      const result = await copyLocationStaffingFromArea({
        locationId: location.id,
        targetAreaId: area.id,
        sourceAreaId: selectedSourceArea.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (result.staffing && result.serviceHours && editorData) {
        applyEditorData({
          ...editorData,
          staffing: result.staffing,
          serviceHours: result.serviceHours,
          qualifications: result.qualifications ?? editorData.qualifications,
        });
      } else {
        matrixRef.current?.reload();
      }
    });
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      const result = await deleteServiceHourStaffing({
        locationId: location.id,
        serviceHourId: confirmDeleteId,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      if (result.staffing && editorData) {
        applyEditorData({
          ...editorData,
          staffing: result.staffing,
        });
      } else {
        matrixRef.current?.reload();
      }

      if (selectedServiceHourId === confirmDeleteId) {
        setSelectedServiceHourId(null);
      }
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={cn(settingsSubModalOverlayClass(), busy && "cursor-wait")}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !anyOverlayOpen && !busy) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-staffing-panel-title"
          aria-hidden={anyOverlayOpen}
          aria-busy={busy}
          className={cn(
            settingsSubModalDialogClass("xl"),
            anyOverlayOpen && "pointer-events-none",
            busy && "[&_*]:cursor-wait"
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
              disabled={busy}
              aria-label={t("common.close")}
              className="border-transparent bg-transparent hover:bg-subtle"
            >
              <CloseIcon className="h-[18px] w-[18px]" />
            </IconButton>
          </div>

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden pb-0",
              settingsModalBodyPaddingClass()
            )}
          >
            {errorMessage && (
              <Alert variant="error" className="mb-3 shrink-0">
                {errorMessage}
              </Alert>
            )}

            <div className="min-h-0 flex-1">
              {loading || !editorData ? (
                <p className="py-6 text-center text-sm text-muted">
                  {t("common.loading")}
                </p>
              ) : (
                <LocationAreaStaffingMatrix
                  ref={matrixRef}
                  locationId={location.id}
                  area={area}
                  initialEditorData={editorData}
                  selectedServiceHourId={selectedServiceHourId}
                  onSelectServiceHour={setSelectedServiceHourId}
                  onEditServiceHour={(serviceHourId) => {
                    setSelectedServiceHourId(serviceHourId);
                    setFormMode("edit");
                    setConfirmDeleteId(null);
                    setErrorMessage(null);
                  }}
                  onDeleteServiceHour={(serviceHourId) => {
                    setSelectedServiceHourId(serviceHourId);
                    setConfirmDeleteId(serviceHourId);
                    setErrorMessage(null);
                  }}
                  embedded
                  listScrollClassName={SETTINGS_STAFFING_PANEL_LIST_SCROLL_CLASS}
                />
              )}
            </div>

            {!loading && !hasQualifications && (
              <p className="mt-2 shrink-0 px-1 text-xs text-muted">
                {t("locations.staffingNoAreaQualificationTemplates")}
              </p>
            )}

            <div className="mt-3 shrink-0 border-t border-border">
              <SettingsActionBar
                primary={
                  <SettingsPrimaryActionButton
                    label={t("locations.new")}
                    icon={<PlusIcon />}
                    disabled={busy}
                    onClick={() => {
                      setFormMode("create");
                      setConfirmDeleteId(null);
                      setErrorMessage(null);
                    }}
                  />
                }
                secondary={
                  <SettingsIconActionButton
                    label={t("locations.edit")}
                    icon={<PencilIcon />}
                    disabled={
                      busy || !selectedServiceHourId || !hasQualifications
                    }
                    onClick={() => {
                      if (!selectedServiceHourId) return;
                      setFormMode("edit");
                      setConfirmDeleteId(null);
                      setErrorMessage(null);
                    }}
                  />
                }
                trailing={
                  sourceAreas.length > 0 ? (
                    <div className="flex min-w-0 items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          busy ||
                          !selectedSourceArea ||
                          copyFromSourceIsNoOp ||
                          !hasQualifications
                        }
                        onClick={handleCopyFromSourceArea}
                        className="h-8 shrink-0 whitespace-nowrap px-2.5 text-xs"
                      >
                        {t("locations.staffingCopyApply")}
                      </Button>
                      <Select
                        className="h-8 shrink-0 px-2 text-xs"
                        style={copySourceSelectStyle}
                        value={selectedSourceAreaId}
                        disabled={busy}
                        aria-label={t("locations.staffingCopySelectArea")}
                        onChange={(event) =>
                          setSelectedSourceAreaId(event.target.value)
                        }
                      >
                        {sourceAreas.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : undefined
                }
              />
            </div>
          </div>

          <div className={settingsModalFooterClass("shrink-0")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={busy}
              className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
            >
              <CloseIcon />
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>

      {formMode && editorData && (
        <LocationStaffingDetailPanelModal
          mode={formMode}
          location={location}
          area={area}
          serviceHours={editorData.serviceHours}
          shiftTemplates={editorData.shiftTemplates ?? []}
          qualifications={editorData.qualifications}
          staffing={editorData.staffing}
          initialServiceHourId={
            formMode === "edit" ? (selectedServiceHourId ?? undefined) : undefined
          }
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}

      {confirmDeleteId && deleteTargetLabel && (
        <DeleteConfirmModal
          name={deleteTargetLabel}
          pending={deleting}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </>
  );
}
