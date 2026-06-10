"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createAreaShiftTemplate,
  updateAreaShiftTemplate,
} from "@/app/actions/area-shift-templates";
import type { ShiftTypeBreakInput } from "@/lib/db";
import {
  centeredBreakForShift,
  getBreakDurationRule,
  getSuggestedBreakMinutes,
  validateAreaShiftTemplateCount,
  validateShiftTypeBreaks,
  validateShiftTypeUniqueness,
  resolveShiftTemplateNameColor,
  resolveShiftTemplateStoredColor,
  isShiftTemplatePickerColor,
} from "@schichtwerk/database";
import { ShiftTemplateColorCombobox } from "./shift-template-color-combobox";
import {
  formatDurationLabel,
  toTimeInputValue,
} from "@/lib/shift-type-display";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import type {
  AreaShiftTemplateBreak,
  AreaShiftTemplateWithBreaks,
} from "@schichtwerk/types";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsColumnHeaderClass,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
  settingsResponsiveTableWrapClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  PlusIcon,
  TrashIcon,
  LabelMuted,
  TimeInput,
} from "@/components/ui";

type BreakDraft = {
  key: string;
  break_start: string;
  break_end: string;
};

type Props = {
  mode: "create" | "edit";
  locationId: string;
  locationAreaId: string;
  template?: AreaShiftTemplateWithBreaks;
  existingTemplates: AreaShiftTemplateWithBreaks[];
  onClose: () => void;
  onSaved: (createdId?: string) => void;
};

function breaksToDrafts(breaks: AreaShiftTemplateBreak[]): BreakDraft[] {
  return breaks.map((entry) => ({
    key: entry.id,
    break_start: toTimeInputValue(entry.break_start),
    break_end: toTimeInputValue(entry.break_end),
  }));
}

function newCenteredBreakDraft(startTime: string, endTime: string): BreakDraft {
  const minutes = getSuggestedBreakMinutes(startTime, endTime);
  const { break_start, break_end } = centeredBreakForShift(startTime, endTime, minutes);
  return { key: crypto.randomUUID(), break_start, break_end };
}

export function AreaShiftTemplateFormModal({
  mode,
  locationId,
  locationAreaId,
  template,
  existingTemplates,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(template?.name ?? "");
  const [color, setColor] = useState(() =>
    resolveShiftTemplateStoredColor(template?.name ?? "", template?.color)
  );
  const [colorManual, setColorManual] = useState(
    () =>
      Boolean(
        template?.color && isShiftTemplatePickerColor(template.color)
      )
  );
  const [startTime, setStartTime] = useState(
    toTimeInputValue(template?.start_time ?? "08:00:00")
  );
  const [endTime, setEndTime] = useState(
    toTimeInputValue(template?.end_time ?? "16:00:00")
  );
  const [breaks, setBreaks] = useState<BreakDraft[]>(() =>
    template?.area_shift_template_breaks?.length
      ? breaksToDrafts(
          [...template.area_shift_template_breaks].sort(
            (a, b) => a.sort_order - b.sort_order
          )
        )
      : []
  );
  const [selectedBreakKey, setSelectedBreakKey] = useState<string | null>(null);

  const durationLabel = useMemo(
    () => formatDurationLabel(`${startTime}:00`, `${endTime}:00`),
    [startTime, endTime]
  );

  const breakRule = useMemo(
    () => getBreakDurationRule(startTime, endTime),
    [startTime, endTime]
  );

  useEffect(() => {
    if (!colorManual) {
      setColor(resolveShiftTemplateNameColor(name));
    }
  }, [name, colorManual]);

  useEffect(() => {
    setBreaks((prev) => {
      if (prev.length === 0) return prev;
      const minutes = getSuggestedBreakMinutes(startTime, endTime);
      const { break_start, break_end } = centeredBreakForShift(
        startTime,
        endTime,
        minutes
      );
      if (breakRule.kind === "required" || prev.length === 1) {
        const key = prev[0]?.key ?? crypto.randomUUID();
        return [{ key, break_start, break_end }];
      }
      return prev;
    });
  }, [startTime, endTime, breakRule.kind]);

  function addBreak() {
    const draft = newCenteredBreakDraft(startTime, endTime);
    setBreaks((prev) =>
      breakRule.kind === "required" ? [draft] : [...prev, draft]
    );
    setSelectedBreakKey(draft.key);
  }

  function removeSelectedBreak() {
    if (!selectedBreakKey) return;
    setBreaks((prev) => prev.filter((entry) => entry.key !== selectedBreakKey));
    setSelectedBreakKey(null);
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError(t("shiftTypes.enterDesignation"));
      return;
    }

    const payload = {
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      color,
      breaks: breaks.map(
        (entry): ShiftTypeBreakInput => ({
          break_start: entry.break_start,
          break_end: entry.break_end,
        })
      ),
    };

    if (mode === "create") {
      const countCheck = validateAreaShiftTemplateCount(
        existingTemplates.length,
        true
      );
      if (!countCheck.ok) {
        setError(countCheck.error);
        return;
      }
    }

    const unique = validateShiftTypeUniqueness(existingTemplates, {
      name: payload.name,
      start_time: payload.start_time,
      end_time: payload.end_time,
      excludeId: mode === "edit" ? template?.id : undefined,
    });
    if (!unique.ok) {
      setError(unique.error);
      return;
    }

    const breaksCheck = validateShiftTypeBreaks(
      payload.start_time,
      payload.end_time,
      payload.breaks
    );
    if (!breaksCheck.ok) {
      setError(breaksCheck.error);
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createAreaShiftTemplate({
              locationId,
              locationAreaId,
              ...payload,
            })
          : await updateAreaShiftTemplate({
              id: template!.id,
              locationId,
              locationAreaId,
              ...payload,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(mode === "create" ? result.id : undefined);
      onClose();
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
        aria-labelledby="area-shift-template-form-title"
        className={settingsNestedModalDialogClass("lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3 id="area-shift-template-form-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {mode === "create"
              ? t("locations.areaShiftTemplatesCreateTitle")
              : t("locations.areaShiftTemplatesEditTitle")}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={pending}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon />
          </IconButton>
        </div>

        <div className={cn("min-h-0 flex-1 space-y-5 overflow-y-auto", settingsModalBodyPaddingClass())}>
          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full min-w-0 sm:w-1/2">
              <LabelMuted>{t("shiftTypes.designation")}</LabelMuted>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Früh"
              />
            </div>
            <div className="w-full min-w-0 sm:w-1/2">
              <LabelMuted>{t("profiles.color")}</LabelMuted>
              <ShiftTemplateColorCombobox
                value={color}
                disabled={pending}
                ariaLabel={t("profiles.selectColor")}
                onChange={(nextColor) => {
                  setColorManual(true);
                  setColor(nextColor);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="min-w-0">
              <LabelMuted>{t("shiftTypes.timeFrom")}</LabelMuted>
              <TimeInput value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="min-w-0">
              <LabelMuted>{t("shiftTypes.timeTo")}</LabelMuted>
              <TimeInput value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <p className="pb-2 text-sm font-medium tabular-nums text-foreground sm:pb-2">
              {durationLabel}
            </p>
          </div>

          <div>
            <div className="mb-2 h-4" aria-hidden />
            <div className="mb-2 flex items-center justify-between gap-2">
              <LabelMuted className="mb-0">{t("locations.areaShiftTemplateBreaksLabel")}</LabelMuted>
              <div className="flex gap-1">
                <IconButton
                  size="sm"
                  aria-label={t("shiftTypes.addBreak")}
                  onClick={addBreak}
                  disabled={
                    pending ||
                    (breakRule.kind === "required" && breaks.length >= 1)
                  }
                >
                  <PlusIcon />
                </IconButton>
                <IconButton
                  size="sm"
                  aria-label={t("shiftTypes.removeBreak")}
                  onClick={removeSelectedBreak}
                  disabled={pending || !selectedBreakKey}
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </div>

            <div className={settingsResponsiveTableWrapClass()}>
            <table className="w-full min-w-[16rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={settingsColumnHeaderClass()}>{t("shiftTypes.breakFrom")}</th>
                  <th className={settingsColumnHeaderClass()}>{t("shiftTypes.breakTo")}</th>
                </tr>
              </thead>
              <tbody>
                {breaks.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-xs text-muted">
                      {t("shiftTypes.noBreaksHint")}
                    </td>
                  </tr>
                ) : (
                  breaks.map((entry) => {
                    const selected = entry.key === selectedBreakKey;
                    return (
                      <tr
                        key={entry.key}
                        onClick={() => setSelectedBreakKey(entry.key)}
                        className={cn(
                          "cursor-pointer border-b border-border last:border-0",
                          selected ? "bg-subtle" : "hover:bg-hover"
                        )}
                      >
                        <td className="py-2 pr-2">
                          <TimeInput
                            value={entry.break_start}
                            onChange={(e) =>
                              setBreaks((prev) =>
                                prev.map((row) =>
                                  row.key === entry.key
                                    ? { ...row, break_start: e.target.value }
                                    : row
                                )
                              )
                            }
                          />
                        </td>
                        <td className="py-2">
                          <TimeInput
                            value={entry.break_end}
                            onChange={(e) =>
                              setBreaks((prev) =>
                                prev.map((row) =>
                                  row.key === entry.key
                                    ? { ...row, break_end: e.target.value }
                                    : row
                                )
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={pending}>
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
