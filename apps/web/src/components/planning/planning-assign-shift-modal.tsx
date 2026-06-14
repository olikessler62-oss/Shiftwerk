"use client";

import { useEffect } from "react";
import { DashboardShiftTypeCombobox } from "@/components/dashboard/dashboard-add-shift-modal";
import {
  dashboardModalBackdropClass,
  dashboardModalDialogClass,
  MODAL_SCROLLBAR_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  SETTINGS_MODAL_TITLE_CLASS,
} from "@/components/settings/settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  Field,
  IconButton,
  LabelMuted,
  Textarea,
  TimeInput,
} from "@/components/ui";
import { parseISODate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { avatarColor, initials } from "@/lib/planning-utils";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import type { Profile } from "@schichtwerk/types";

type Props = {
  employee: Profile;
  date: string;
  intlLocale: string;
  t: (key: string) => string;
  simplePlanning: boolean;
  assignmentPresets: DashboardAssignmentPreset[];
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  dayReadOnly: boolean;
  pending: boolean;
  timesComplete: boolean;
  canAssign: boolean;
  hasExistingShift: boolean;
  onAssign: () => void;
  onRemove: () => void;
  onClose: () => void;
};

export function PlanningAssignShiftModal({
  employee,
  date,
  intlLocale,
  t,
  simplePlanning,
  assignmentPresets,
  selectedPresetId,
  onPresetChange,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  note,
  onNoteChange,
  dayReadOnly,
  pending,
  timesComplete,
  canAssign,
  hasExistingShift,
  onAssign,
  onRemove,
  onClose,
}: Props) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  const dateLabel = new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseISODate(date));

  return (
    <div
      className={dashboardModalBackdropClass()}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-assign-shift-title"
        className={cn(dashboardModalDialogClass("lg"), MODAL_SCROLLBAR_CLASS)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3
            id="planning-assign-shift-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {t("planning.assignTitle")}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={pending}
            aria-label={t("common.close")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div
          className={cn(
            settingsModalBodyPaddingClass(),
            "min-h-0 flex-1 overflow-y-auto",
            MODAL_SCROLLBAR_CLASS
          )}
        >
          <div className="space-y-4">
            {dayReadOnly ? (
              <p className="text-xs text-muted">{t("planning.readOnlyDay")}</p>
            ) : null}

            {!simplePlanning && assignmentPresets.length === 0 ? (
              <Alert variant="info">
                {t("dashboard.noShiftTemplatesForArea")}
              </Alert>
            ) : null}

            <div className="rounded-[var(--radius-control)] bg-subtle px-3 py-2 text-sm">
              <span className="text-muted">{t("planning.assignDateLabel")}: </span>
              <span className="font-medium">{dateLabel}</span>
            </div>

            {!simplePlanning ? (
              <div>
                <LabelMuted>{t("dashboard.shiftTemplateLabel")}</LabelMuted>
                <DashboardShiftTypeCombobox
                  value={selectedPresetId}
                  presets={assignmentPresets}
                  placeholder={t("dashboard.selectShiftTemplate")}
                  disabled={dayReadOnly || assignmentPresets.length === 0}
                  onChange={onPresetChange}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelMuted>{t("shiftTypes.timeFrom")}</LabelMuted>
                <TimeInput
                  className="mt-1"
                  value={startTime}
                  disabled={dayReadOnly}
                  onChange={(event) => onStartTimeChange(event.target.value)}
                />
              </div>
              <div>
                <LabelMuted>{t("shiftTypes.timeTo")}</LabelMuted>
                <TimeInput
                  className="mt-1"
                  value={endTime}
                  disabled={dayReadOnly}
                  onChange={(event) => onEndTimeChange(event.target.value)}
                />
              </div>
            </div>

            <Field label="Personal">
              <div
                className={cn(
                  "max-h-48 overflow-y-auto rounded-lg border border-border",
                  MODAL_SCROLLBAR_CLASS
                )}
              >
                <label className="flex cursor-pointer items-center gap-2 border-b border-border bg-primary/5 px-3 py-2.5">
                  <input type="radio" checked readOnly className="accent-primary" />
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{
                      backgroundColor: avatarColor(employee.full_name),
                    }}
                  >
                    {initials(employee.full_name)}
                  </span>
                  <span className="text-sm font-medium">{employee.full_name}</span>
                </label>
              </div>
            </Field>

            <Field label={t("planning.assignNoteLabel")}>
              <Textarea
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                rows={2}
                disabled={dayReadOnly}
                placeholder={t("planning.assignNotePlaceholder")}
              />
            </Field>
          </div>
        </div>

        <div className={settingsModalFooterClass()}>
          <Button
            type="button"
            variant="ghost"
            className="text-muted"
            disabled={pending}
            onClick={onClose}
          >
            {t("planning.assignCancel")}
          </Button>
          <div className="flex flex-wrap gap-2">
            {hasExistingShift && !dayReadOnly ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={onRemove}
              >
                {t("planning.assignRemove")}
              </Button>
            ) : null}
            {!dayReadOnly ? (
              <Button
                type="button"
                variant="primary"
                disabled={pending || !timesComplete || !canAssign}
                onClick={onAssign}
              >
                {t("planning.assignSubmit")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
