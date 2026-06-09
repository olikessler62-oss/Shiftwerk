"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AbsenceRange } from "@schichtwerk/database";
import type { AbsenceRequest, AbsenceType, Profile } from "@schichtwerk/types";
import {
  deleteAbsence,
  fetchOrganizationAbsences,
  type AbsenceDraft,
} from "@/app/actions/absences";
import {
  applyCreatedListSelection,
  SETTINGS_ABSENCES_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  settingsColumnHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
  settingsPanelHeaderClass,
  useScrollToSettingsListItem,
} from "./settings-list-ui";
import { AbsenceFormModal } from "./absence-form-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";

type Props = {
  profiles: Profile[];
  onClose: () => void;
};

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; absence: AbsenceRequest };

const NOTES_MAX = 40;

function truncateNotes(value: string | null): string {
  if (!value) return "";
  if (value.length <= NOTES_MAX) return value;
  return `${value.slice(0, NOTES_MAX - 1)}…`;
}

function emptyDraft(): AbsenceDraft {
  return {
    employee_id: "",
    type: "vacation",
    start_date: "",
    end_date: "",
    notes: null,
  };
}

function draftFromAbsence(absence: AbsenceRequest): AbsenceDraft {
  return {
    employee_id: absence.employee_id,
    type: absence.type,
    start_date: absence.start_date,
    end_date: absence.end_date,
    notes: absence.notes,
  };
}

export function AbsencesModal({ profiles, onClose }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AbsenceRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(toIntlLocale(locale), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale]
  );

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const existingRanges = useMemo(
    (): AbsenceRange[] =>
      list.map((entry) => ({
        id: entry.id,
        employee_id: entry.employee_id,
        start_date: entry.start_date,
        end_date: entry.end_date,
      })),
    [list]
  );

  const selected = list.find((entry) => entry.id === selectedId);

  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(list, scrollToItemId, clearScrollTarget);

  const loadAbsences = useCallback(async () => {
    setLoading(true);
    const result = await fetchOrganizationAbsences();
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }
    setList(result.absences);
    setSelectedId((current) => {
      if (current && result.absences.some((entry) => entry.id === current)) {
        return current;
      }
      return result.absences[0]?.id ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAbsences();
  }, [loadAbsences]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [loading]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (loading) {
        onClose();
        return;
      }
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
  }, [confirmDelete, formMode, loading, onClose]);

  function typeLabel(type: AbsenceType): string {
    switch (type) {
      case "vacation":
        return t("settings.absences.typeVacation");
      case "sick":
        return t("settings.absences.typeSick");
      case "other":
        return t("settings.absences.typeOther");
    }
  }

  function refreshList() {
    router.refresh();
  }

  function handleFormSaved(createdId?: string) {
    applyCreatedListSelection(createdId, setSelectedId, setScrollToItemId);
    void loadAbsences();
    refreshList();
  }

  function openCreate() {
    setFormMode({ type: "create" });
    setConfirmDelete(false);
    setErrorMessage(null);
  }

  function openEdit(absence: AbsenceRequest) {
    setFormMode({ type: "edit", absence });
    setConfirmDelete(false);
    setErrorMessage(null);
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteAbsence(selected.id);
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

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4",
        loading && "cursor-wait"
      )}
      role="presentation"
      aria-busy={loading}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !formMode && !confirmDelete) {
          onClose();
        }
      }}
    >
      {!loading ? (
      <div
        className="relative w-full max-w-4xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="absences-modal-title"
          aria-hidden={!!formMode}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            formMode ? "pointer-events-none" : ""
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 id="absences-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("settings.absences.title")}
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
              <h3 className={settingsPanelHeaderClass()}>
                {t("settings.absences.column")}
              </h3>

              <div
                className={cn(
                  "space-y-1 bg-background px-2 py-2",
                  SETTINGS_ABSENCES_LIST_SCROLL_CLASS
                )}
              >
                {list.length === 0 ? (
                  <SettingsEmptyState
                    message={t("settings.absences.emptyList")}
                    hint={t("common.emptyHintCreate")}
                  />
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="w-3 p-0" aria-hidden />
                        <th className={settingsColumnHeaderClass()}>
                          {t("settings.absences.employee")}
                        </th>
                        <th className={settingsColumnHeaderClass()}>
                          {t("settings.absences.type")}
                        </th>
                        <th className={settingsColumnHeaderClass()}>
                          {t("settings.absences.startDate")}
                        </th>
                        <th className={settingsColumnHeaderClass()}>
                          {t("settings.absences.endDate")}
                        </th>
                        <th className={settingsColumnHeaderClass()}>
                          {t("settings.absences.notes")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item) => {
                        const profile = profileById.get(item.employee_id);
                        const isSelected = item.id === selectedId;
                        return (
                          <tr
                            key={item.id}
                            {...settingsListItemAttrs(item.id)}
                            onClick={() => {
                              setSelectedId(item.id);
                              setConfirmDelete(false);
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
                            <td className={settingsDataCellClass(isSelected)}>
                              <span className="flex min-w-0 items-center gap-2">
                                {profile?.color ? (
                                  <span
                                    className="size-3 shrink-0 rounded-full border border-border/60"
                                    style={{ backgroundColor: profile.color }}
                                    aria-hidden
                                  />
                                ) : null}
                                <span className="truncate font-medium">
                                  {profile?.full_name ?? "—"}
                                </span>
                              </span>
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {typeLabel(item.type)}
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {dateFormatter.format(new Date(`${item.start_date}T12:00:00`))}
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {dateFormatter.format(new Date(`${item.end_date}T12:00:00`))}
                            </td>
                            <td
                              className={settingsDataCellClass(isSelected, {
                                className: "max-w-[10rem] truncate text-muted",
                              })}
                              title={item.notes ?? undefined}
                            >
                              {truncateNotes(item.notes)}
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
                    label={t("settings.absences.new")}
                    icon={<PlusIcon />}
                    disabled={pending}
                    onClick={openCreate}
                  />
                }
                secondary={
                  <SettingsIconActionButton
                    label={t("settings.absences.edit")}
                    icon={<PencilIcon />}
                    disabled={pending || !selected}
                    onClick={() => {
                      if (!selected) return;
                      openEdit(selected);
                    }}
                  />
                }
                destructive={
                  <SettingsIconActionButton
                    label={t("settings.absences.delete")}
                    icon={<TrashIcon />}
                    disabled={pending || !selected}
                    onClick={() => {
                      if (!selected) return;
                      setConfirmDelete(true);
                    }}
                  />
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              <CloseIcon />
              {t("common.close")}
            </Button>
          </div>
        </div>

        {formMode && (
          <AbsenceFormModal
            mode={formMode.type}
            absenceId={formMode.type === "edit" ? formMode.absence.id : undefined}
            initialDraft={
              formMode.type === "create"
                ? emptyDraft()
                : draftFromAbsence(formMode.absence)
            }
            profiles={profiles}
            existingRanges={existingRanges}
            onClose={() => setFormMode(null)}
            onSaved={handleFormSaved}
          />
        )}

        {confirmDelete && selected && (
          <DeleteConfirmModal
            name={`${profileById.get(selected.employee_id)?.full_name ?? "—"} (${dateFormatter.format(new Date(`${selected.start_date}T12:00:00`))} – ${dateFormatter.format(new Date(`${selected.end_date}T12:00:00`))})`}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            pending={pending}
          />
        )}
      </div>
      ) : null}
    </div>
  );
}
