"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCompensationSurchargeType,
  reorderCompensationSurchargeTypes,
} from "@/app/actions/compensation-surcharge-types";
import type { CompensationSurchargeType } from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { formatSurchargeAmountLabel } from "@/lib/profile-compensation-calculation";
import {
  formatSurchargeTriggerLabel,
  formatSurchargeUnitLabel,
} from "@/lib/profile-surcharge-display";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { CompensationSurchargeTypeFormModal } from "./compensation-surcharge-type-form-modal";
import {
  MODAL_SCROLLBAR_CLASS,
  SETTINGS_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  SettingsListRowDeleteButton,
  SettingsListRowCheckbox,
  SettingsBulkDeleteActionButton,
  applyCreatedListSelection,
  settingsListItemAttrs,
  useScrollToSettingsListItem,
  settingsListRowDeleteCellClass,
  settingsListRowDeleteHeaderClass,
  settingsListRowCheckboxCellClass,
  settingsListRowCheckboxHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsPanelHeaderClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";

type Props = {
  surchargeTypes: CompensationSurchargeType[];
  onClose: () => void;
};

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; surchargeType: CompensationSurchargeType };

export function CompensationSurchargeTypesModal({
  surchargeTypes,
  onClose,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(surchargeTypes);
  const [selectedId, setSelectedId] = useState<string | null>(
    surchargeTypes[0]?.id ?? null
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  useEffect(() => {
    setList(surchargeTypes);
    setSelectedId((current) => {
      if (current && surchargeTypes.some((entry) => entry.id === current)) {
        return current;
      }
      return surchargeTypes[0]?.id ?? null;
    });
  }, [surchargeTypes]);

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
      if (confirmBulkDelete) {
        setConfirmBulkDelete(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmBulkDelete, confirmDelete, formMode, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const { sortedList, canMoveUp, canMoveDown, handleMove } =
    useSettingsListReorder({
      list,
      setList,
      selectedId,
      pending,
      startTransition,
      reorder: reorderCompensationSurchargeTypes,
      onError: setErrorMessage,
      onSuccess: () => router.refresh(),
    });
  const selected = sortedList.find((entry) => entry.id === selectedId);
  const surchargeTypeIds = useMemo(
    () => sortedList.map((item) => item.id),
    [sortedList]
  );
  const bulkSelection = useSettingsListBulkSelection(surchargeTypeIds);
  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(sortedList, scrollToItemId, clearScrollTarget);

  function refreshList() {
    router.refresh();
  }

  function handleFormSaved(createdId?: string) {
    applyCreatedListSelection(createdId, setSelectedId, setScrollToItemId);
    refreshList();
  }

  function openEdit(surchargeType: CompensationSurchargeType) {
    setFormMode({ type: "edit", surchargeType });
    setConfirmDelete(false);
    setErrorMessage(null);
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteCompensationSurchargeType(selected.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDelete(false);
        return;
      }
      setList((prev) => {
        const remaining = prev.filter((entry) => entry.id !== selected.id);
        setSelectedId(remaining[0]?.id ?? null);
        return remaining;
      });
      setConfirmDelete(false);
      refreshList();
    });
  }

  function handleBulkDelete() {
    const ids = surchargeTypeIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      for (const id of ids) {
        const result = await deleteCompensationSurchargeType(id);
        if (!result.ok) {
          setErrorMessage(result.error);
          bulkSelection.clear();
          setConfirmBulkDelete(false);
          refreshList();
          return;
        }
      }
      setList((prev) => {
        const remaining = prev.filter((item) => !ids.includes(item.id));
        setSelectedId((current) =>
          current && remaining.some((item) => item.id === current)
            ? current
            : (remaining[0]?.id ?? null)
        );
        return remaining;
      });
      bulkSelection.clear();
      setConfirmBulkDelete(false);
      refreshList();
    });
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !formMode && !confirmDelete && !confirmBulkDelete) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compensation-surcharge-types-modal-title"
          aria-hidden={!!formMode}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            MODAL_SCROLLBAR_CLASS,
            formMode ? "pointer-events-none" : ""
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2
              id="compensation-surcharge-types-modal-title"
              className={SETTINGS_MODAL_TITLE_CLASS}
            >
              {t("surcharges.title")}
            </h2>
            <IconButton
              size="sm"
              onClick={onClose}
              aria-label={t("common.close")}
              className="border-transparent bg-transparent hover:bg-subtle"
            >
              <CloseIcon className="h-[18px] w-[18px]" />
            </IconButton>
          </div>

          {errorMessage && (
            <div className="mx-6 mt-4 shrink-0">
              <Alert variant="error">{errorMessage}</Alert>
            </div>
          )}

          <div className="bg-background px-6 py-4">
            <div className="flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
              <h3 className={settingsPanelHeaderClass()}>{t("surcharges.column")}</h3>

              <div
                className={cn(
                  "space-y-1 bg-background px-2 py-2",
                  SETTINGS_LIST_SCROLL_CLASS
                )}
              >
                {list.length === 0 ? (
                  <SettingsEmptyState
                    message={t("surcharges.emptyList")}
                    hint={t("common.emptyHintCreate")}
                  />
                ) : (
                  <table className="w-full min-w-[36rem] border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          className={settingsStickyIndicatorHeaderClass()}
                          aria-hidden
                        />
                        <th className={settingsStickyColumnHeaderClass()}>
                          {t("surcharges.designation")}
                        </th>
                        <th className={settingsStickyColumnHeaderClass()}>
                          {t("surcharges.trigger")}
                        </th>
                        <th className={settingsStickyColumnHeaderClass("right")}>
                          {t("surcharges.amount")}
                        </th>
                        <th className={settingsStickyColumnHeaderClass()}>
                          {t("surcharges.unit")}
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
                      {sortedList.map((item) => {
                        const isSelected = item.id === selectedId;
                        return (
                          <tr
                            key={item.id}
                            {...settingsListItemAttrs(item.id)}
                            onClick={() => {
                              setSelectedId(item.id);
                              setConfirmDelete(false);
                              setConfirmBulkDelete(false);
                              setErrorMessage(null);
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              window.getSelection()?.removeAllRanges();
                              openEdit(item);
                            }}
                            className={settingsDataRowClass(isSelected)}
                          >
                            <td
                              className={settingsIndicatorCellClass(isSelected)}
                              aria-hidden
                            />
                            <td
                              className={settingsDataCellClass(isSelected, {
                                className: "font-medium",
                              })}
                            >
                              {item.name}
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {formatSurchargeTriggerLabel(item.trigger, t)}
                            </td>
                            <td
                              className={settingsDataCellClass(isSelected, {
                                align: "right",
                                className: "whitespace-nowrap tabular-nums",
                              })}
                            >
                              {formatSurchargeAmountLabel(
                                item.amount,
                                item.unit,
                                localeKey
                              )}
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {formatSurchargeUnitLabel(item.unit, t)}
                            </td>
                            <td className={settingsListRowCheckboxCellClass(isSelected)}>
                              <SettingsListRowCheckbox
                                checked={bulkSelection.isChecked(item.id)}
                                disabled={pending}
                                ariaLabel={t("common.selectRow")}
                                onChange={() => bulkSelection.toggle(item.id)}
                              />
                            </td>
                            <td className={settingsListRowDeleteCellClass(isSelected)}>
                              <SettingsListRowDeleteButton
                                label={t("surcharges.delete")}
                                disabled={pending}
                                showTooltip={false}
                                onClick={() => {
                                  setSelectedId(item.id);
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
                )}
              </div>

              <SettingsActionBar
                primary={
                  <SettingsPrimaryActionButton
                    label={t("surcharges.new")}
                    icon={<PlusIcon />}
                    disabled={pending}
                    onClick={() => {
                      setFormMode({ type: "create" });
                      setConfirmDelete(false);
                      setConfirmBulkDelete(false);
                    }}
                  />
                }
                secondary={
                  <>
                    <SettingsIconActionButton
                      label={t("surcharges.edit")}
                      icon={<PencilIcon />}
                      disabled={pending || !selected}
                      onClick={() => {
                        if (!selected) return;
                        openEdit(selected);
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
                destructive={
                  <SettingsBulkDeleteActionButton
                    label={t("common.deleteSelectedEntries")}
                    disabled={pending || !bulkSelection.canBulkDelete}
                    onClick={() => {
                      setConfirmDelete(false);
                      setFormMode(null);
                      setConfirmBulkDelete(true);
                    }}
                  />
                }
              />
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

        {formMode?.type === "create" && (
          <CompensationSurchargeTypeFormModal
            key="create"
            mode="create"
            existingTypes={list}
            onClose={() => setFormMode(null)}
            onSaved={handleFormSaved}
          />
        )}
        {formMode?.type === "edit" && (
          <CompensationSurchargeTypeFormModal
            key={formMode.surchargeType.id}
            mode="edit"
            surchargeType={formMode.surchargeType}
            existingTypes={list}
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
        {confirmBulkDelete && bulkSelection.checkedCount > 0 && (
          <DeleteConfirmModal
            name={t("common.deleteSelectedEntries")}
            count={bulkSelection.checkedCount}
            pending={pending}
            onCancel={() => setConfirmBulkDelete(false)}
            onConfirm={handleBulkDelete}
          />
        )}
      </div>
    </div>
  );
}
