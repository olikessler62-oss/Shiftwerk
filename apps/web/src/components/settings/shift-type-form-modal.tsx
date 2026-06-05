"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createShiftType,
  updateShiftType,
  type ShiftTypeBreakInput,
} from "@/app/actions/shift-types";
import {
  centeredBreakForShift,
  getBreakDurationRule,
  getSuggestedBreakMinutes,
  validateShiftTypeBreaks,
  validateShiftTypeCount,
  validateShiftTypeUniqueness,
} from "@schichtwerk/database";
import {
  formatDurationLabel,
  toTimeInputValue,
} from "@/lib/shift-type-display";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import type { ShiftTypeBreak, ShiftTypeWithBreaks } from "@schichtwerk/types";
import { SETTINGS_MODAL_TITLE_CLASS, settingsColumnHeaderClass } from "./settings-list-ui";
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
  shiftType?: ShiftTypeWithBreaks;
  existingShiftTypes: ShiftTypeWithBreaks[];
  onClose: () => void;
  onSaved: () => void;
};

function breaksToDrafts(breaks: ShiftTypeBreak[]): BreakDraft[] {
  return breaks.map((b) => ({
    key: b.id,
    break_start: toTimeInputValue(b.break_start),
    break_end: toTimeInputValue(b.break_end),
  }));
}

function newCenteredBreakDraft(startTime: string, endTime: string): BreakDraft {
  const minutes = getSuggestedBreakMinutes(startTime, endTime);
  const { break_start, break_end } = centeredBreakForShift(startTime, endTime, minutes);
  return { key: crypto.randomUUID(), break_start, break_end };
}

export function ShiftTypeFormModal({
  mode,
  shiftType,
  existingShiftTypes,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(shiftType?.name ?? "");
  const [startTime, setStartTime] = useState(
    toTimeInputValue(shiftType?.start_time ?? "08:00:00")
  );
  const [endTime, setEndTime] = useState(
    toTimeInputValue(shiftType?.end_time ?? "16:00:00")
  );
  const [breaks, setBreaks] = useState<BreakDraft[]>(() =>
    shiftType?.shift_type_breaks?.length
      ? breaksToDrafts(
          [...shiftType.shift_type_breaks].sort((a, b) => a.sort_order - b.sort_order)
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
    setBreaks((prev) => prev.filter((b) => b.key !== selectedBreakKey));
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
      breaks: breaks.map(
        (b): ShiftTypeBreakInput => ({
          break_start: b.break_start,
          break_end: b.break_end,
        })
      ),
    };

    if (mode === "create") {
      const countCheck = validateShiftTypeCount(existingShiftTypes.length, true);
      if (!countCheck.ok) {
        setError(countCheck.error);
        return;
      }
    }

    const unique = validateShiftTypeUniqueness(existingShiftTypes, {
      name: payload.name,
      start_time: payload.start_time,
      end_time: payload.end_time,
      excludeId: mode === "edit" ? shiftType?.id : undefined,
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
          ? await createShiftType(payload)
          : await updateShiftType({ id: shiftType!.id, ...payload });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-type-form-title"
        className="relative z-[71] flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="shift-type-form-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {mode === "create" ? t("shiftTypes.createTitle") : t("shiftTypes.editTitle")}
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

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("shiftTypes.designation")}</LabelMuted>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Zwischenschicht"
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[120px] flex-1">
              <LabelMuted>{t("shiftTypes.timeFrom")}</LabelMuted>
              <TimeInput value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="min-w-[120px] flex-1">
              <LabelMuted>{t("shiftTypes.timeTo")}</LabelMuted>
              <TimeInput value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <p className="pb-2 text-sm font-medium tabular-nums text-foreground">
              {durationLabel}
            </p>
          </div>

          <div>
            <div className="mb-2 h-4" aria-hidden />
            <div className="mb-2 flex items-center justify-between gap-2">
              <LabelMuted className="mb-0">{t("shiftTypes.breaks")}</LabelMuted>
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

            <table className="w-full border-collapse text-sm">
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
                  breaks.map((b) => {
                    const selected = b.key === selectedBreakKey;
                    return (
                      <tr
                        key={b.key}
                        onClick={() => setSelectedBreakKey(b.key)}
                        className={cn(
                          "cursor-pointer border-b border-border last:border-0",
                          selected ? "bg-subtle" : "hover:bg-hover"
                        )}
                      >
                        <td className="py-2 pr-2">
                          <TimeInput
                            value={b.break_start}
                            onChange={(e) =>
                              setBreaks((prev) =>
                                prev.map((row) =>
                                  row.key === b.key
                                    ? { ...row, break_start: e.target.value }
                                    : row
                                )
                              )
                            }
                          />
                        </td>
                        <td className="py-2">
                          <TimeInput
                            value={b.break_end}
                            onChange={(e) =>
                              setBreaks((prev) =>
                                prev.map((row) =>
                                  row.key === b.key
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

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
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
