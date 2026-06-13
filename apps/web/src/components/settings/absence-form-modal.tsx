"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  findOverlappingAbsence,
  validateAbsenceDateOrder,
  type AbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceType, Profile } from "@schichtwerk/types";
import {
  checkAbsenceShiftConflictForDraft,
  createAbsence,
  updateAbsence,
  type AbsenceDraft,
} from "@/app/actions/absences";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useComboboxCloseOnPointerDistance } from "@/lib/use-combobox-close";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsConfirmDialogClass,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
  Select,
  Textarea,
} from "@/components/ui";

const ABSENCE_TYPES: AbsenceType[] = ["vacation", "sick", "other"];

type Props = {
  mode: "create" | "edit";
  absenceId?: string;
  initialDraft: AbsenceDraft;
  profiles: Profile[];
  existingRanges: AbsenceRange[];
  onClose: () => void;
  onSaved: (createdId?: string) => void;
};

function EmployeeColorSwatch({ hex }: { hex: string | null }) {
  if (!hex) {
    return (
      <span
        className="inline-block size-2.5 shrink-0 rounded-full border border-border/60 bg-transparent"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full border border-border/60"
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

function ProfileEmployeeCombobox({
  value,
  onChange,
  profiles,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (employeeId: string) => void;
  profiles: Profile[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeCombobox = () => setOpen(false);
  useComboboxCloseOnPointerDistance(open, closeCombobox, [rootRef]);

  const selected = useMemo(
    () => profiles.find((profile) => profile.id === value) ?? null,
    [profiles, value]
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 min-h-9 w-full items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-left text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <EmployeeColorSwatch hex={selected?.color ?? null} />
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted")}>
          {selected?.full_name ?? placeholder}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted hover:bg-subtle"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <EmployeeColorSwatch hex={null} />
              <span className="min-w-0 flex-1 truncate">{placeholder}</span>
              {!value ? <CheckIcon className="h-4 w-4 shrink-0 text-primary" /> : null}
            </button>
          </li>
          {profiles.map((profile) => (
            <li key={profile.id} role="option" aria-selected={value === profile.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-subtle"
                onClick={() => {
                  onChange(profile.id);
                  setOpen(false);
                }}
              >
                <EmployeeColorSwatch hex={profile.color} />
                <span className="min-w-0 flex-1 truncate">{profile.full_name}</span>
                {value === profile.id ? (
                  <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AbsenceFormModal({
  mode,
  absenceId,
  initialDraft,
  profiles,
  existingRanges,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shiftConflictCount, setShiftConflictCount] = useState<number | null>(
    null
  );
  const [employeeId, setEmployeeId] = useState(initialDraft.employee_id);
  const [type, setType] = useState<AbsenceType | "">(
    mode === "create" && !initialDraft.employee_id ? "" : initialDraft.type || ""
  );
  const [startDate, setStartDate] = useState(initialDraft.start_date);
  const [endDate, setEndDate] = useState(initialDraft.end_date);
  const [notes, setNotes] = useState(initialDraft.notes ?? "");

  const activeProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_active),
    [profiles]
  );

  function typeLabel(value: AbsenceType): string {
    switch (value) {
      case "vacation":
        return t("settings.absences.typeVacation");
      case "sick":
        return t("settings.absences.typeSick");
      case "other":
        return t("settings.absences.typeOther");
    }
  }

  function mapSaveError(code: string): string {
    switch (code) {
      case "MISSING_EMPLOYEE":
        return t("settings.absences.validation.missingEmployee");
      case "MISSING_TYPE":
        return t("settings.absences.validation.missingType");
      case "MISSING_DATES":
        return t("settings.absences.validation.missingDates");
      case "END_BEFORE_START":
        return t("settings.absences.validation.endBeforeStart");
      case "OVERLAP":
        return t("settings.absences.validation.overlap");
      default:
        return code;
    }
  }

  function buildDraft(): AbsenceDraft | null {
    if (!employeeId) {
      setError(t("settings.absences.validation.missingEmployee"));
      return null;
    }
    if (!type) {
      setError(t("settings.absences.validation.missingType"));
      return null;
    }
    if (!startDate || !endDate) {
      setError(t("settings.absences.validation.missingDates"));
      return null;
    }

    const dateOrder = validateAbsenceDateOrder(startDate, endDate);
    if (!dateOrder.ok) {
      setError(t("settings.absences.validation.endBeforeStart"));
      return null;
    }

    const overlap = findOverlappingAbsence(
      existingRanges,
      {
        id: absenceId,
        employee_id: employeeId,
        start_date: startDate,
        end_date: endDate,
      },
      absenceId
    );
    if (overlap) {
      setError(t("settings.absences.validation.overlap"));
      return null;
    }

    return {
      employee_id: employeeId,
      type,
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() ? notes.trim() : null,
    };
  }

  async function executeSave(draft: AbsenceDraft) {
    const result =
      mode === "create"
        ? await createAbsence(draft)
        : await updateAbsence(absenceId!, draft);

    if (!result.ok) {
      setError(mapSaveError(result.error));
      setShiftConflictCount(null);
      return;
    }

    onSaved(result.id);
    onClose();
  }

  function handleSubmit(skipConflictCheck = false) {
    setError(null);
    const draft = buildDraft();
    if (!draft) return;

    startTransition(async () => {
      if (!skipConflictCheck) {
        const conflictResult = await checkAbsenceShiftConflictForDraft(
          draft,
          mode === "edit" ? absenceId : undefined
        );
        if (!conflictResult.ok) {
          setError(conflictResult.error);
          return;
        }
        if (conflictResult.count > 0) {
          setShiftConflictCount(conflictResult.count);
          return;
        }
      }

      await executeSave(draft);
    });
  }

  return (
    <div
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="absence-form-title"
        className={settingsNestedModalDialogClass("lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3 id="absence-form-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {mode === "create"
              ? t("settings.absences.createTitle")
              : t("settings.absences.editTitle")}
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

        <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto", settingsModalBodyPaddingClass())}>
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("settings.absences.employee")}</LabelMuted>
            <ProfileEmployeeCombobox
              value={employeeId}
              onChange={setEmployeeId}
              profiles={activeProfiles}
              placeholder={t("settings.absences.selectEmployee")}
              disabled={pending}
            />
          </div>

          <div>
            <LabelMuted>{t("settings.absences.type")}</LabelMuted>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as AbsenceType | "")}
              disabled={pending}
            >
              <option value="">{t("settings.absences.type")}</option>
              {ABSENCE_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {typeLabel(entry)}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <LabelMuted>{t("settings.absences.startDate")}</LabelMuted>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={pending}
              />
            </div>
            <div>
              <LabelMuted>{t("settings.absences.endDate")}</LabelMuted>
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <div>
            <LabelMuted>{t("settings.absences.notes")}</LabelMuted>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("settings.absences.notesPlaceholder")}
              rows={3}
              disabled={pending}
            />
          </div>
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleSubmit()}
            disabled={pending}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>

        {shiftConflictCount !== null && (
          <div
            className={settingsNestedModalOverlayClass("z-[72]")}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !pending) {
                setShiftConflictCount(null);
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="absence-form-shift-conflict-title"
              className={settingsConfirmDialogClass("z-[73]")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h4
                id="absence-form-shift-conflict-title"
                className="text-base font-semibold text-foreground"
              >
                {t("settings.absences.shiftConflictTitle")}
              </h4>
              <p className="mt-2 text-sm text-muted">
                {t("settings.absences.shiftConflictMessage", {
                  count: shiftConflictCount,
                })}
              </p>
              <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShiftConflictCount(null)}
                  disabled={pending}
                >
                  {t("settings.absences.shiftConflictBack")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleSubmit(true)}
                  disabled={pending}
                >
                  {t("settings.absences.shiftConflictProceed")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
