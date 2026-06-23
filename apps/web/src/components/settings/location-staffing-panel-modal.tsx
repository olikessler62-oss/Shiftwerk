"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
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
  SettingsBulkDeleteActionButton,
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
  ListIcon,
  PencilIcon,
  PlusIcon,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import { useDeferredSettingsModalRender } from "./use-deferred-settings-modal-render";
import { settingsFixedNestedOverlayClass } from "./settings-modal-shell";

type Props = {
  location: Location;
  area: LocationArea;
  cachedServiceHours?: LocationAreaServiceHour[];
  cachedStaffing?: LocationAreaStaffing[];
  cachedShiftTemplates?: AreaShiftTemplateWithBreaks[];
  onClose: () => void;
  onCacheUpdate?: (
    areaId: string,
    staffing: LocationAreaStaffing[],
    serviceHours: LocationAreaServiceHour[]
  ) => void;
  onShiftTemplatesCacheUpdate?: (
    areaId: string,
    templates: AreaShiftTemplateWithBreaks[]
  ) => void;
  embedded?: boolean;
};

type FormMode = null | "create" | "edit" | "bulk-edit";

export function LocationStaffingPanelModal({
  location,
  area,
  cachedServiceHours,
  cachedStaffing,
  cachedShiftTemplates,
  onClose,
  onCacheUpdate,
  onShiftTemplatesCacheUpdate,
  embedded = false,
}: Props) {
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
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
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
    setEditorData(null);
    setErrorMessage(null);
    setSelectedServiceHourId(null);
    setFormMode(null);
    setConfirmDeleteId(null);

    void Promise.all([
      fetchLocationStaffingEditor(location.id, area.id),
      fetchAreaShiftTemplates(location.id, area.id),
      fetchLocationStaffingSources(location.id, area.id),
    ]).then(([editorResult, templatesResult, sourcesResult]) => {
      if (cancelled) return;

      if (sourcesResult.ok) {
        const sources = sourcesResult.sources ?? [];
        setSourceAreas(sources);
        setSelectedSourceAreaId(sources[0]?.id ?? "");
      } else {
        setSourceAreas([]);
        setSelectedSourceAreaId("");
      }

      const shiftTemplates =
        templatesResult.ok === true ? (templatesResult.templates ?? []) : [];
      onShiftTemplatesCacheUpdate?.(area.id, shiftTemplates);

      if (!editorResult.ok) {
        setErrorMessage(editorResult.error);
        setEditorData({
          serviceHours: [],
          qualifications: [],
          staffing: [],
          shiftTemplates,
        });
      } else {
        const nextData: StaffingEditorData = {
          serviceHours: editorResult.serviceHours ?? [],
          qualifications: editorResult.qualifications ?? [],
          staffing: editorResult.staffing ?? [],
          shiftTemplates,
        };
        setEditorData(nextData);
        onCacheUpdate?.(
          area.id,
          nextData.staffing,
          nextData.serviceHours
        );
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    area.id,
    location.id,
    onCacheUpdate,
    onShiftTemplatesCacheUpdate,
  ]);

  useLayoutEffect(() => {
    if (!editorData || loading) return;
    matrixRef.current?.applyStaffing(editorData.staffing, editorData.serviceHours);
  }, [editorData, loading]);

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
      if (confirmBulkDelete) {
        setConfirmBulkDelete(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmBulkDelete, confirmDeleteId, deleting, formMode, onClose, pending]);

  const configuredServiceHours = (editorData?.serviceHours ?? []).filter((hour) =>
    (editorData?.staffing ?? []).some(
      (rule) => rule.service_hour_id === hour.id && rule.required_count > 0
    )
  );
  const configuredServiceHourIds = useMemo(
    () => configuredServiceHours.map((hour) => hour.id),
    [configuredServiceHours]
  );
  const bulkSelection = useSettingsListBulkSelection(configuredServiceHourIds);

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

  const anyOverlayOpen =
    formMode !== null || confirmDeleteId !== null || confirmBulkDelete;
  const hasQualifications = (editorData?.qualifications.length ?? 0) > 0;
  const busy = deleting || pending;

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
    setConfirmBulkDelete(false);
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

  async function handleBulkDelete() {
    const ids = configuredServiceHourIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      let latestStaffing = editorData?.staffing;
      for (const serviceHourId of ids) {
        const result = await deleteServiceHourStaffing({
          locationId: location.id,
          serviceHourId,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          matrixRef.current?.reload();
          bulkSelection.clear();
          setConfirmBulkDelete(false);
          return;
        }
        latestStaffing = result.staffing ?? latestStaffing;
      }

      if (latestStaffing && editorData) {
        applyEditorData({
          ...editorData,
          staffing: latestStaffing,
        });
      } else {
        matrixRef.current?.reload();
      }

      if (selectedServiceHourId && ids.includes(selectedServiceHourId)) {
        setSelectedServiceHourId(null);
      }
      bulkSelection.clear();
      setConfirmBulkDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const showModal = useDeferredSettingsModalRender(loading, onClose);
  if (!embedded && (!showModal || !editorData)) return null;
  if (embedded && loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-12 text-sm text-muted">
        {t("common.loading")}
      </div>
    );
  }
  if (embedded && !editorData) return null;

  const panelInner = (
    <>
      {!embedded ? (
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3 id="location-staffing-panel-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            <span className="text-foreground">{t("locations.panelStaffingOfPrefix")} </span>
            <span className="text-primary">
              {location.name} | {area.name}
            </span>
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
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden pb-0",
          settingsModalBodyPaddingClass(),
          embedded && "bg-background"
        )}
      >
            {errorMessage && (
              <Alert variant="error" className="mb-3 shrink-0">
                {errorMessage}
              </Alert>
            )}

            <div className="min-h-0 flex-1">
              <LocationAreaStaffingMatrix
                    key={`${location.id}:${area.id}`}
                    ref={matrixRef}
                    locationId={location.id}
                    area={area}
                    initialEditorData={editorData!}
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
                      setConfirmBulkDelete(false);
                      setConfirmDeleteId(serviceHourId);
                      setErrorMessage(null);
                    }}
                    bulkSelection={{
                      isChecked: bulkSelection.isChecked,
                      onToggle: bulkSelection.toggle,
                      disabled: busy,
                    }}
                    embedded
                    listScrollClassName={SETTINGS_STAFFING_PANEL_LIST_SCROLL_CLASS}
                  />
                </div>

                {!hasQualifications && (
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
                          setConfirmBulkDelete(false);
                          setErrorMessage(null);
                        }}
                      />
                    }
                    secondary={
                      <>
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
                            setConfirmBulkDelete(false);
                            setErrorMessage(null);
                          }}
                        />
                        <SettingsIconActionButton
                          label={t("locations.staffingBulkEdit")}
                          icon={<ListIcon />}
                          disabled={
                            busy || !selectedServiceHourId || !hasQualifications
                          }
                          onClick={() => {
                            if (!selectedServiceHourId) return;
                            setFormMode("bulk-edit");
                            setConfirmDeleteId(null);
                            setConfirmBulkDelete(false);
                            setErrorMessage(null);
                          }}
                        />
                        {sourceAreas.length > 0 ? (
                          <>
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
                          </>
                        ) : null}
                      </>
                    }
                    destructive={
                      <SettingsBulkDeleteActionButton
                        label={t("common.deleteSelectedEntries")}
                        disabled={busy || !bulkSelection.canBulkDelete}
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setFormMode(null);
                          setConfirmBulkDelete(true);
                        }}
                      />
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
              {embedded ? t("locations.title") : t("common.close")}
            </Button>
          </div>
    </>
  );

  const panelOverlays = (
    <>
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
            formMode === "edit" || formMode === "bulk-edit"
              ? (selectedServiceHourId ?? undefined)
              : undefined
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
      {confirmBulkDelete && bulkSelection.checkedCount > 0 && (
        <DeleteConfirmModal
          name={t("common.deleteSelectedEntries")}
          count={bulkSelection.checkedCount}
          pending={deleting}
          onCancel={() => setConfirmBulkDelete(false)}
          onConfirm={() => void handleBulkDelete()}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          busy && "cursor-wait [&_*]:cursor-wait"
        )}
        aria-busy={busy}
      >
        {panelInner}
        {panelOverlays}
      </div>
    );
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
            settingsSubModalDialogClass(
              "5xl",
              "max-w-[min(48.64rem,calc(100vw-2rem))] max-h-[min(90dvh,calc(720px+100px))]"
            ),
            anyOverlayOpen && "pointer-events-none",
            busy && "[&_*]:cursor-wait"
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {panelInner}
        </div>
      </div>
      {panelOverlays}
    </>
  );
}
