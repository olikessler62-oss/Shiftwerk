"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  copyAreaShiftTemplatesFromArea,
  deleteAreaShiftTemplate,
  fetchAreaShiftTemplateSources,
  fetchAreaShiftTemplates,
  fetchOrganizationCountryCode,
  reorderAreaShiftTemplates,
  type AreaShiftTemplateSourceArea,
} from "@/app/actions/area-shift-templates";
import { MAX_AREA_SHIFT_TEMPLATES_PER_AREA, resolveShiftTemplateStoredColor } from "@schichtwerk/database";
import type { AreaShiftTemplateWithBreaks, Location, LocationArea } from "@schichtwerk/types";
import {
  formatBreakTotal,
  formatClock,
  shiftTypeDuration,
} from "@/lib/shift-type-display";
import { useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { AreaShiftTemplateFormModal } from "./area-shift-template-form-modal";
import { shiftColorStyle } from "@/lib/shift-color-style";
import {
  SETTINGS_LIST_SCROLL_COMPACT_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  SettingsListRowDeleteButton,
  applyCreatedListSelection,
  settingsScrollableTableListClass,
  settingsListRowDeleteCellClass,
  settingsListRowDeleteHeaderClass,
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
  PencilIcon,
  PlusIcon,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { areaShiftTemplatesSetsEqual } from "@/lib/location-area-copy-compare";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";
import { useDeferredSettingsModalRender } from "./use-deferred-settings-modal-render";

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; template: AreaShiftTemplateWithBreaks };

type Props = {
  location: Location;
  area: LocationArea;
  onClose: () => void;
  onCacheUpdate?: (
    areaId: string,
    templates: AreaShiftTemplateWithBreaks[]
  ) => void;
  embedded?: boolean;
};

const COLUMN_LABEL_KEYS = [
  "shiftTypes.designation",
  "shiftTypes.timeFrom",
  "shiftTypes.timeTo",
  "shiftTypes.duration",
  "shiftTypes.breaks",
] as const;

function sortedBreaks(template: AreaShiftTemplateWithBreaks) {
  return [...(template.area_shift_template_breaks ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );
}

export function AreaShiftTemplatesPanelModal({
  location,
  area,
  onClose,
  onCacheUpdate,
  embedded = false,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState<AreaShiftTemplateWithBreaks[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [sourceAreas, setSourceAreas] = useState<AreaShiftTemplateSourceArea[]>(
    []
  );
  const [selectedSourceAreaId, setSelectedSourceAreaId] = useState("");
  const [countryCode, setCountryCode] = useState("DE");

  const applyTemplates = useCallback(
    (templates: AreaShiftTemplateWithBreaks[]) => {
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
      fetchAreaShiftTemplates(location.id, area.id),
      fetchAreaShiftTemplateSources(location.id, area.id),
      fetchOrganizationCountryCode(),
    ]).then(([templatesResult, sourcesResult, countryResult]) => {
      if (cancelled) return;

      if (countryResult.ok) {
        setCountryCode(countryResult.countryCode);
      }

      if (sourcesResult.ok) {
        const sources = sourcesResult.sources ?? [];
        setSourceAreas(sources);
        setSelectedSourceAreaId(sources[0]?.id ?? "");
      } else {
        setSourceAreas([]);
        setSelectedSourceAreaId("");
      }

      if (!templatesResult.ok) {
        setErrorMessage(templatesResult.error);
        setList([]);
        onCacheUpdate?.(area.id, []);
      } else {
        const templates = templatesResult.templates ?? [];
        setList(templates);
        onCacheUpdate?.(area.id, templates);
        setSelectedId((current) => {
          if (current && templates.some((entry) => entry.id === current)) {
            return current;
          }
          return templates[0]?.id ?? null;
        });
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
      if (formMode) {
        setFormMode(null);
        return;
      }
      if (confirmDelete) {
        setConfirmDelete(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete, formMode, onClose]);

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      const result = await reorderAreaShiftTemplates({
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

  const selected = sortedList.find((entry) => entry.id === selectedId) ?? null;
  const selectedSourceArea =
    sourceAreas.find((entry) => entry.id === selectedSourceAreaId) ?? null;
  const copySourceSelectStyle = useMemo(() => {
    const longestChars = sourceAreas.reduce(
      (max, source) => Math.max(max, source.name.length),
      0
    );
    return {
      width: `calc(${Math.max(longestChars, 4)}ch + 2.25rem)`,
      maxWidth: "100%",
    };
  }, [sourceAreas]);
  const copyFromSourceIsNoOp = useMemo(() => {
    if (!selectedSourceArea) return true;
    return areaShiftTemplatesSetsEqual(list, selectedSourceArea.templates);
  }, [list, selectedSourceArea]);
  const atTemplateLimit = list.length >= MAX_AREA_SHIFT_TEMPLATES_PER_AREA;
  const anyOverlayOpen = !!formMode || confirmDelete;
  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(sortedList, scrollToItemId, clearScrollTarget);

  function handleFormSaved(createdId?: string) {
    applyCreatedListSelection(createdId, setSelectedId, setScrollToItemId);
    void fetchAreaShiftTemplates(location.id, area.id).then((result) => {
      if (result.ok && result.templates) {
        applyTemplates(result.templates);
      }
    });
  }

  function handleCopyFromSourceArea() {
    if (!selectedSourceArea) return;
    setErrorMessage(null);
    setConfirmDelete(false);
    setFormMode(null);
    startTransition(async () => {
      const result = await copyAreaShiftTemplatesFromArea({
        locationId: location.id,
        targetAreaId: area.id,
        sourceAreaId: selectedSourceArea.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (result.templates) {
        applyTemplates(result.templates);
      }
    });
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteAreaShiftTemplate({
        id: selected.id,
        locationId: location.id,
        locationAreaId: area.id,
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
            <h3 id="area-shift-templates-panel-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              <span className="text-foreground">
                {t("locations.panelShiftTemplatesOfPrefix")}{" "}
              </span>
              <span className="text-primary">
                {location.name} | {area.name}
              </span>
            </h3>
            <p className="mt-1 text-xs text-muted">
              {t("locations.areaShiftTemplatesHint")}
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

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
              {list.length === 0 ? (
            <SettingsEmptyState
              message={t("locations.areaShiftTemplatesEmpty")}
              hint={t("common.emptyHintCreate")}
              className="min-h-full"
            />
          ) : (
            <div
              className={cn(
                settingsScrollableTableListClass(),
                SETTINGS_LIST_SCROLL_COMPACT_CLASS
              )}
            >
              <table className="w-full min-w-[28rem] border-collapse sm:min-w-[32rem]">
                <thead>
                  <tr className="border-b border-border">
                    <th
                      className={settingsStickyIndicatorHeaderClass()}
                      aria-hidden
                    />
                    {COLUMN_LABEL_KEYS.map((label, index) => (
                      <th
                        key={label}
                        className={settingsStickyColumnHeaderClass(
                          index === 0 ? "left" : "center"
                        )}
                      >
                        {t(label)}
                      </th>
                    ))}
                    <th
                      className={settingsListRowDeleteHeaderClass()}
                      aria-hidden
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedList.map((template) => {
                    const isSelected = template.id === selectedId;
                    const breaks = sortedBreaks(template);
                    return (
                      <tr
                        key={template.id}
                        {...settingsListItemAttrs(template.id)}
                        onClick={() => {
                          setSelectedId(template.id);
                          setConfirmDelete(false);
                          setErrorMessage(null);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          setFormMode({ type: "edit", template });
                          setConfirmDelete(false);
                          setErrorMessage(null);
                        }}
                        className={settingsDataRowClass(isSelected)}
                      >
                        <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                        <td className={settingsDataCellClass(isSelected, { className: "font-medium" })}>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="box-border h-3 w-3 shrink-0 border border-black"
                              style={shiftColorStyle(
                                resolveShiftTemplateStoredColor(
                                  template.name,
                                  template.color
                                )
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{template.name}</span>
                          </span>
                        </td>
                        <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                          {formatClock(template.start_time)}
                        </td>
                        <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                          {formatClock(template.end_time)}
                        </td>
                        <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                          {shiftTypeDuration(template.start_time, template.end_time)}
                        </td>
                        <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                          {breaks.length > 0 ? formatBreakTotal(breaks) : "—"}
                        </td>
                        <td className={settingsListRowDeleteCellClass(isSelected)}>
                          <SettingsListRowDeleteButton
                            label={t("locations.delete")}
                            disabled={pending}
                            onClick={() => {
                              setSelectedId(template.id);
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
                disabled={pending || atTemplateLimit}
                tooltip={
                  atTemplateLimit
                    ? t("locations.areaShiftTemplatesMax", {
                        max: MAX_AREA_SHIFT_TEMPLATES_PER_AREA,
                      })
                    : undefined
                }
                onClick={() => {
                  setFormMode({ type: "create" });
                  setConfirmDelete(false);
                  setErrorMessage(null);
                }}
              />
            }
            secondary={
              <>
                <SettingsIconActionButton
                  label={t("locations.edit")}
                  icon={<PencilIcon />}
                  disabled={pending || !selected}
                  onClick={() => {
                    if (!selected) return;
                    setFormMode({ type: "edit", template: selected });
                    setConfirmDelete(false);
                    setErrorMessage(null);
                  }}
                />
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
              </>
            }
            trailing={
              sourceAreas.length > 0 ? (
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      pending ||
                      !selectedSourceArea ||
                      copyFromSourceIsNoOp
                    }
                    onClick={handleCopyFromSourceArea}
                    className="h-8 shrink-0 whitespace-nowrap px-2.5 text-xs"
                  >
                    {t("locations.areaShiftTemplatesCopyApply")}
                  </Button>
                  <Select
                    className="h-8 shrink-0 px-2 text-xs"
                    style={copySourceSelectStyle}
                    value={selectedSourceAreaId}
                    disabled={pending}
                    aria-label={t("locations.areaShiftTemplatesCopySelectArea")}
                    onChange={(event) => setSelectedSourceAreaId(event.target.value)}
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
      {formMode && (
        <AreaShiftTemplateFormModal
          key={
            formMode.type === "edit" ? `edit-${formMode.template.id}` : "create"
          }
          mode={formMode.type}
          locationId={location.id}
          locationAreaId={area.id}
          countryCode={countryCode}
          template={formMode.type === "edit" ? formMode.template : undefined}
          existingTemplates={list}
          onClose={() => setFormMode(null)}
          onSaved={handleFormSaved}
        />
      )}
      {confirmDelete && selected && (
        <DeleteConfirmModal
          name={selected.name}
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
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
        aria-labelledby="area-shift-templates-panel-title"
        aria-busy={pending}
        aria-hidden={anyOverlayOpen}
        className={cn(
          settingsSubModalDialogClass("2xl"),
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
