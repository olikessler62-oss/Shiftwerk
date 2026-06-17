"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRole, reorderRoles } from "@/app/actions/roles";
import type { Role, RolePermissionLevel } from "@schichtwerk/types";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { RoleFormModal } from "./role-form-modal";
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
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
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
} from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";

type Props = {
  roles: Role[];
  onClose: () => void;
};

type FormMode = null | { type: "create" } | { type: "edit"; role: Role };

function permissionLabel(
  t: (key: string) => string,
  level: RolePermissionLevel
): string {
  if (level === "admin") return t("roles.permissionAdmin");
  if (level === "manager") return t("roles.permissionManager");
  return t("roles.permissionBasic");
}

export function RolesModal({ roles, onClose }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(roles);
  const [selectedId, setSelectedId] = useState<string | null>(roles[0]?.id ?? null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  useEffect(() => {
    setList(roles);
    setSelectedId((current) => {
      if (current && roles.some((r) => r.id === current)) return current;
      return roles[0]?.id ?? null;
    });
  }, [roles]);

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
    reorder: reorderRoles,
    onError: setErrorMessage,
    onSuccess: () => router.refresh(),
  });
  const selected = sortedList.find((r) => r.id === selectedId);
  const roleIds = useMemo(() => sortedList.map((item) => item.id), [sortedList]);
  const deletableRoleIds = useMemo(
    () => new Set(sortedList.filter((item) => !item.is_system).map((item) => item.id)),
    [sortedList]
  );
  const bulkSelection = useSettingsListBulkSelection(roleIds, {
    selectableIds: deletableRoleIds,
  });
  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(sortedList, scrollToItemId, clearScrollTarget);

  function refreshList() {
    router.refresh();
  }

  function handleFormSaved(createdId?: string) {
    applyCreatedListSelection(createdId, setSelectedId, setScrollToItemId);
    refreshList();
  }

  function openEdit(role: Role) {
    setFormMode({ type: "edit", role });
    setConfirmDelete(false);
    setErrorMessage(null);
  }

  function handleDelete() {
    if (!selected || selected.is_system) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteRole(selected.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDelete(false);
        return;
      }
      setList((prev) => {
        const remaining = prev.filter((r) => r.id !== selected.id);
        setSelectedId(remaining[0]?.id ?? null);
        return remaining;
      });
      setConfirmDelete(false);
      refreshList();
    });
  }

  function handleBulkDelete() {
    const ids = roleIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      for (const id of ids) {
        const result = await deleteRole(id);
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
      <div className="relative w-full max-w-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="roles-modal-title"
          aria-hidden={!!formMode}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            MODAL_SCROLLBAR_CLASS,
            formMode ? "pointer-events-none" : ""
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 id="roles-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("roles.title")}
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
              <h3 className={settingsPanelHeaderClass()}>{t("roles.column")}</h3>

              <div className={cn("space-y-1 bg-background px-2 py-2", SETTINGS_LIST_SCROLL_CLASS)}>
                {list.length === 0 ? (
                  <SettingsEmptyState
                    message={t("roles.emptyList")}
                    hint={t("common.emptyHintCreate")}
                  />
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          className={settingsStickyIndicatorHeaderClass()}
                          aria-hidden
                        />
                        <th className={settingsStickyColumnHeaderClass()}>
                          {t("roles.designation")}
                        </th>
                        <th className={settingsStickyColumnHeaderClass("center")}>
                          {t("roles.permission")}
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
                            <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                            <td className={settingsDataCellClass(isSelected, { className: "font-medium" })}>
                              {item.name}
                            </td>
                            <td className={settingsDataCellClass(isSelected, { align: "center", className: "text-muted" })}>
                              {permissionLabel(t, item.permission_level)}
                            </td>
                            <td className={settingsListRowCheckboxCellClass(isSelected)}>
                              <SettingsListRowCheckbox
                                checked={bulkSelection.isChecked(item.id)}
                                disabled={pending || item.is_system}
                                ariaLabel={t("common.selectRow")}
                                onChange={() => bulkSelection.toggle(item.id)}
                              />
                            </td>
                            <td className={settingsListRowDeleteCellClass(isSelected)}>
                              <SettingsListRowDeleteButton
                                label={t("roles.delete")}
                                disabled={pending || item.is_system}
                                title={item.is_system ? t("roles.systemRoleHint") : undefined}
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
                    label={t("roles.new")}
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
                      label={t("roles.edit")}
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
          <RoleFormModal
            mode="create"
            existingRoles={list}
            onClose={() => setFormMode(null)}
            onSaved={handleFormSaved}
          />
        )}
        {formMode?.type === "edit" && (
          <RoleFormModal
            mode="edit"
            role={formMode.role}
            existingRoles={list}
            onClose={() => setFormMode(null)}
            onSaved={handleFormSaved}
          />
        )}
        {confirmDelete && selected && !selected.is_system && (
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
