"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchAreaQualificationTemplates,
  fetchOrganizationQualificationsForAreaTemplates,
  removeAreaQualificationTemplate,
  reorderAreaQualificationTemplates,
} from "@/app/actions/area-qualification-templates";
import type {
  AreaQualificationTemplateEntry,
  Location,
  LocationArea,
  Qualification,
} from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { AreaQualificationTemplateFormModal } from "./area-qualification-template-form-modal";
import {
  SETTINGS_FOUR_ROW_TABLE_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  SettingsListRowDeleteButton,
  SettingsListRowCheckbox,
  SettingsBulkDeleteActionButton,
  applyCreatedListSelection,
  settingsScrollableTableListClass,
  settingsListRowDeleteCellClass,
  settingsListRowDeleteHeaderClass,
  settingsListRowCheckboxCellClass,
  settingsListRowCheckboxHeaderClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
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
  PlusIcon,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";
import { useDeferredSettingsModalRender } from "./use-deferred-settings-modal-render";

type Props = {
  location: Location;
  area: LocationArea;
  onClose: () => void;
  onCacheUpdate?: (
    areaId: string,
    templates: AreaQualificationTemplateEntry[]
  ) => void;
  embedded?: boolean;
};

const MAX_NAME_DISPLAY = 25;

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function AreaQualificationTemplatesPanelModal({
  location,
  area,
  onClose,
  onCacheUpdate,
  embedded = false,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState<AreaQualificationTemplateEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [allQualifications, setAllQualifications] = useState<Qualification[]>(
    []
  );

  const applyTemplates = useCallback(
    (templates: AreaQualificationTemplateEntry[]) => {
      setList(templates);
      onCacheUpdate?.(area.id, templates);
      setSelectedId((current) => {
        if (current && templates.some((entry) => entry.id === current)) {
          return current;
        }
        return templates[0]?.id ?? null;
      });
    },
    [onCacheUpdate, area.id]
  );

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setErrorMessage(null);
    void Promise.all([
      fetchAreaQualificationTemplates(location.id, area.id),
      fetchOrganizationQualificationsForAreaTemplates(),
    ]).then(([templatesResult, orgResult]) => {
      if (cancelled) return;
      if (!templatesResult.ok) {
        setErrorMessage(templatesResult.error);
        setList([]);
        onCacheUpdate?.(area.id, []);
      } else {
        applyTemplates(templatesResult.templates ?? []);
      }
      if (orgResult.ok && orgResult.qualifications) {
        setAllQualifications(orgResult.qualifications);
      }
      setInitialLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only when area/location changes
  }, [location.id, area.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (formOpen) {
        setFormOpen(false);
        return;
      }
      if (confirmDelete) {
        setConfirmDelete(false);
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
  }, [confirmBulkDelete, confirmDelete, formOpen, onClose]);

  const assignedIds = useMemo(
    () => new Set(list.map((entry) => entry.qualification_id)),
    [list]
  );
  const unassignedQualifications = useMemo(
    () => allQualifications.filter((qualification) => !assignedIds.has(qualification.id)),
    [allQualifications, assignedIds]
  );

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      const result = await reorderAreaQualificationTemplates({
        locationId: location.id,
        locationAreaId: area.id,
        orderedIds,
      });
      if (result.ok && result.templates) {
        applyTemplates(result.templates);
      }
      return result;
    },
    [location.id, area.id, applyTemplates]
  );

  const {
    sortedList,
    canMoveUp,
    canMoveDown,
    handleMove,
  } = useSettingsListReorder({
    list,
    setList,
    selectedId,
    pending,
    startTransition,
    reorder,
    onError: setErrorMessage,
  });

  const templateIds = useMemo(
    () => sortedList.map((entry) => entry.id),
    [sortedList]
  );
  const bulkSelection = useSettingsListBulkSelection(templateIds);

  const selected = sortedList.find((entry) => entry.id === selectedId) ?? null;
  const anyOverlayOpen = formOpen || confirmDelete || confirmBulkDelete;
  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(sortedList, scrollToItemId, clearScrollTarget);

  function handleFormSaved() {
    void fetchAreaQualificationTemplates(location.id, area.id).then((result) => {
      if (result.ok && result.templates) {
        applyCreatedListSelection(
          result.templates[result.templates.length - 1]?.id,
          setSelectedId,
          setScrollToItemId
        );
        applyTemplates(result.templates);
      }
    });
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await removeAreaQualificationTemplate({
        locationId: location.id,
        locationAreaId: area.id,
        templateId: selected.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDelete(false);
        return;
      }
      applyTemplates(result.templates ?? []);
      setConfirmDelete(false);
    });
  }

  function handleBulkDelete() {
    const ids = templateIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let latestTemplates = list;
      for (const templateId of ids) {
        const result = await removeAreaQualificationTemplate({
          locationId: location.id,
          locationAreaId: area.id,
          templateId,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          bulkSelection.clear();
          setConfirmBulkDelete(false);
          return;
        }
        latestTemplates = result.templates ?? latestTemplates;
      }
      applyTemplates(latestTemplates);
      bulkSelection.clear();
      setConfirmBulkDelete(false);
    });
  }

  const showModal = useDeferredSettingsModalRender(initialLoading, onClose);
  if (!embedded && !showModal) return null;
  if (embedded && initialLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-12 text-sm text-muted">
        {t("common.loading")}
      </div>
    );
  }

  const panelContent = (
    <>
      {!embedded ? (
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <div className="min-w-0">
            <h3
              id="area-qualification-templates-panel-title"
              className={SETTINGS_MODAL_TITLE_CLASS}
            >
              <span className="text-foreground">
                {t("locations.panelQualificationTemplatesOfPrefix")}{" "}
              </span>
              <span className="text-primary">
                {location.name} | {area.name}
              </span>
            </h3>
            <p className="mt-1 text-xs text-muted">
              {t("locations.areaQualificationTemplatesHint")}
            </p>
          </div>
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
      ) : null}

        {errorMessage && (
          <div className="mx-4 mt-3 shrink-0">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        )}

        <div className="shrink-0 overflow-hidden px-4 py-3">
              {list.length === 0 ? (
                <SettingsEmptyState
                  message={t("locations.areaQualificationTemplatesEmpty")}
                  hint={t("common.emptyHintCreate")}
                />
              ) : (
                <div
                  className={cn(
                    settingsScrollableTableListClass(),
                    SETTINGS_FOUR_ROW_TABLE_LIST_SCROLL_CLASS
                  )}
                >
                  <table className="w-full min-w-[16rem] border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          className={settingsStickyIndicatorHeaderClass()}
                          aria-hidden
                        />
                        <th className={settingsStickyColumnHeaderClass("left")}>
                          {t("profiles.columnQualification")}
                        </th>
                        <th
                          className={settingsListRowCheckboxHeaderClass()}
                          aria-hidden
                        />
                        <th
                          className={settingsListRowDeleteHeaderClass()}
                          aria-hidden
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedList.map((entry) => {
                        const isSelected = entry.id === selectedId;
                        const name = entry.qualification.name;
                        return (
                          <tr
                            key={entry.id}
                            {...settingsListItemAttrs(entry.id)}
                            onClick={() => {
                              setSelectedId(entry.id);
                              setConfirmDelete(false);
                              setConfirmBulkDelete(false);
                              setErrorMessage(null);
                            }}
                            className={settingsDataRowClass(isSelected)}
                          >
                            <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                            <td
                              className={settingsDataCellClass(isSelected, {
                                className: "font-medium",
                              })}
                            >
                              <Tooltip content={name} className="block max-w-full truncate">
                                {truncateLabel(name)}
                              </Tooltip>
                            </td>
                            <td className={settingsListRowCheckboxCellClass(isSelected)}>
                              <SettingsListRowCheckbox
                                checked={bulkSelection.isChecked(entry.id)}
                                disabled={pending}
                                ariaLabel={t("common.selectRow")}
                                onChange={() => bulkSelection.toggle(entry.id)}
                              />
                            </td>
                            <td className={settingsListRowDeleteCellClass(isSelected)}>
                              <SettingsListRowDeleteButton
                                label={t("locations.delete")}
                                disabled={pending}
                                showTooltip={false}
                                onClick={() => {
                                  setSelectedId(entry.id);
                                  setConfirmBulkDelete(false);
                                  setConfirmDelete(true);
                                  setErrorMessage(null);
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border px-4 py-3">
              <SettingsActionBar
                primary={
                  <SettingsPrimaryActionButton
                    label={t("locations.new")}
                    icon={<PlusIcon />}
                    disabled={pending || unassignedQualifications.length === 0}
                    tooltip={
                      unassignedQualifications.length === 0
                        ? t("locations.areaQualificationTemplatesAllAssigned")
                        : undefined
                    }
                    onClick={() => {
                      setFormOpen(true);
                      setConfirmDelete(false);
                      setConfirmBulkDelete(false);
                      setErrorMessage(null);
                    }}
                  />
                }
                secondary={
                  <SettingsReorderButtons
                    moveUpLabel={t("common.moveUp")}
                    moveDownLabel={t("common.moveDown")}
                    disabled={pending}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onMoveUp={() => {
                      setErrorMessage(null);
                      handleMove(-1);
                    }}
                    onMoveDown={() => {
                      setErrorMessage(null);
                      handleMove(1);
                    }}
                  />
                }
                destructive={
                  <SettingsBulkDeleteActionButton
                    label={t("common.deleteSelectedEntries")}
                    disabled={pending || !bulkSelection.canBulkDelete}
                    onClick={() => {
                      setConfirmDelete(false);
                      setFormOpen(false);
                      setConfirmBulkDelete(true);
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
            {embedded ? t("locations.title") : t("common.close")}
          </Button>
        </div>
    </>
  );

  const panelOverlays = (
    <>
      {formOpen && (
        <AreaQualificationTemplateFormModal
          locationId={location.id}
          locationAreaId={area.id}
          availableQualifications={unassignedQualifications}
          onClose={() => setFormOpen(false)}
          onSaved={handleFormSaved}
        />
      )}
      {confirmDelete && selected && (
        <DeleteConfirmModal
          name={selected.qualification.name}
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
      {confirmBulkDelete && bulkSelection.checkedCount > 0 && (
        <DeleteConfirmModal
          name={t("common.deleteSelectedEntries")}
          count={bulkSelection.checkedCount}
          pending={pending}
          onCancel={() => setConfirmBulkDelete(false)}
          onConfirm={handleBulkDelete}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          pending && "cursor-wait [&_*]:cursor-wait"
        )}
        aria-busy={pending}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden bg-background",
            anyOverlayOpen && "pointer-events-none"
          )}
        >
          {panelContent}
        </div>
        {panelOverlays}
      </div>
    );
  }

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), pending && "cursor-wait")}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !anyOverlayOpen) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="area-qualification-templates-panel-title"
        aria-busy={pending}
        aria-hidden={anyOverlayOpen}
        className={cn(
          settingsSubModalDialogClass("lg"),
          pending && "[&_*]:cursor-wait",
          anyOverlayOpen ? "pointer-events-none" : ""
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
      {panelOverlays}
    </div>
  );
}
