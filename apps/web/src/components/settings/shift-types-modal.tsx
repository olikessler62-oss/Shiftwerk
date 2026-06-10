"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteShiftType, reorderShiftTypes } from "@/app/actions/shift-types";
import { MAX_SHIFT_TYPES_PER_ORGANIZATION } from "@schichtwerk/database";
import type { ShiftTypeWithBreaks } from "@schichtwerk/types";
import {
  formatBreakTotal,
  formatClock,
  shiftTypeDuration,
} from "@/lib/shift-type-display";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ShiftTypeFormModal } from "./shift-type-form-modal";
import {
  SETTINGS_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  applyCreatedListSelection,
  settingsListItemAttrs,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsModalRootClass,
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
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
  IconButton,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";

type Props = {
  shiftTypes: ShiftTypeWithBreaks[];
  onClose: () => void;
};

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; shiftType: ShiftTypeWithBreaks };

const COLUMN_LABEL_KEYS = [
  "shiftTypes.designation",
  "shiftTypes.timeFrom",
  "shiftTypes.timeTo",
  "shiftTypes.duration",
  "shiftTypes.breaks",
] as const;

function sortedBreaks(type: ShiftTypeWithBreaks) {
  return [...(type.shift_type_breaks ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );
}

export function ShiftTypesModal({ shiftTypes, onClose }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(shiftTypes);
  const [selectedId, setSelectedId] = useState<string | null>(
    shiftTypes[0]?.id ?? null
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  useEffect(() => {
    setList(shiftTypes);
    setSelectedId((current) => {
      if (current && shiftTypes.some((st) => st.id === current)) return current;
      return shiftTypes[0]?.id ?? null;
    });
  }, [shiftTypes]);

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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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
    reorder: reorderShiftTypes,
    onError: setErrorMessage,
    onSuccess: () => router.refresh(),
  });
  const selected = sortedList.find((st) => st.id === selectedId);
  const atShiftTypeLimit = list.length >= MAX_SHIFT_TYPES_PER_ORGANIZATION;
  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(sortedList, scrollToItemId, clearScrollTarget);

  function refreshList() {
    router.refresh();
  }

  function handleFormSaved(createdId?: string) {
    applyCreatedListSelection(createdId, setSelectedId, setScrollToItemId);
    refreshList();
  }

  function openEdit(shiftType: ShiftTypeWithBreaks) {
    setFormMode({ type: "edit", shiftType });
    setConfirmDelete(false);
    setErrorMessage(null);
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteShiftType(selected.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDelete(false);
        return;
      }
      setList((prev) => {
        const remaining = prev.filter((st) => st.id !== selected.id);
        setSelectedId(remaining[0]?.id ?? null);
        return remaining;
      });
      setConfirmDelete(false);
      refreshList();
    });
  }

  return (
    <div
      className={settingsModalBackdropClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !formMode && !confirmDelete) onClose();
      }}
    >
      <div className={settingsModalRootClass("3xl")} onMouseDown={(e) => e.stopPropagation()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shift-types-modal-title"
          aria-hidden={!!formMode}
          className={cn(
            settingsModalDialogClass(),
            formMode ? "pointer-events-none" : ""
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between border-b border-border",
              settingsModalHeaderPaddingClass()
            )}
          >
            <h2 id="shift-types-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("shiftTypes.title")}
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

          <div className={cn(settingsModalBodyPaddingClass(), "bg-background")}>
            <div className="flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
              <h3 className={settingsPanelHeaderClass()}>{t("shiftTypes.title")}</h3>

              <div className="bg-background px-2 py-2">
                {list.length === 0 ? (
                  <SettingsEmptyState
                    message={t("shiftTypes.emptyList")}
                    hint={t("common.emptyHintCreate")}
                  />
                ) : (
                  <div
                    className={cn(
                      settingsScrollableTableListClass(),
                      SETTINGS_LIST_SCROLL_CLASS
                    )}
                  >
                    <table className="w-full min-w-[28rem] border-collapse sm:min-w-[36rem]">
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
                        </tr>
                      </thead>
                      <tbody>
                        {sortedList.map((type) => {
                          const isSelected = type.id === selectedId;
                          const breaks = sortedBreaks(type);
                          return (
                            <tr
                              key={type.id}
                              {...settingsListItemAttrs(type.id)}
                              onClick={() => {
                                setSelectedId(type.id);
                                setConfirmDelete(false);
                                setErrorMessage(null);
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                window.getSelection()?.removeAllRanges();
                                openEdit(type);
                              }}
                              className={settingsDataRowClass(isSelected)}
                            >
                              <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                              <td className={settingsDataCellClass(isSelected, { className: "font-medium" })}>
                                {type.name}
                              </td>
                              <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                                {formatClock(type.start_time)}
                              </td>
                              <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                                {formatClock(type.end_time)}
                              </td>
                              <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                                {shiftTypeDuration(type.start_time, type.end_time)}
                              </td>
                              <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                                {breaks.length > 0 ? formatBreakTotal(breaks) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <SettingsActionBar
                primary={
                  <SettingsPrimaryActionButton
                    label={t("shiftTypes.new")}
                    icon={<PlusIcon />}
                    disabled={pending || atShiftTypeLimit}
                    title={
                      atShiftTypeLimit
                        ? t("shiftTypes.maxTypes", {
                            max: MAX_SHIFT_TYPES_PER_ORGANIZATION,
                          })
                        : undefined
                    }
                    onClick={() => {
                      setFormMode({ type: "create" });
                      setConfirmDelete(false);
                    }}
                  />
                }
                secondary={
                  <>
                    <SettingsIconActionButton
                      label={t("shiftTypes.edit")}
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
                  <SettingsIconActionButton
                    label={t("shiftTypes.delete")}
                    icon={<TrashIcon />}
                    disabled={pending || !selected}
                    onClick={() => {
                      setConfirmDelete(true);
                      setErrorMessage(null);
                    }}
                  />
                }
              />
            </div>
          </div>

          <div className={settingsModalFooterClass("shrink-0 px-4 sm:px-6")}>
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
          <ShiftTypeFormModal
            mode="create"
            existingShiftTypes={list}
            onClose={() => setFormMode(null)}
            onSaved={handleFormSaved}
          />
        )}
        {formMode?.type === "edit" && (
          <ShiftTypeFormModal
            mode="edit"
            shiftType={formMode.shiftType}
            existingShiftTypes={list}
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
      </div>
    </div>
  );
}
