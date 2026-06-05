"use client";

import { useMemo, useState, useTransition } from "react";
import { saveShiftTypeStaffing } from "@/app/actions/location-staffing";
import {
  isStaffingDayEnabled,
  STAFFING_HOLIDAY_WEEKDAY,
} from "@/lib/location-staffing-client";
import type {
  Location,
  LocationArea,
  LocationAreaStaffing,
  ShiftType,
} from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { SETTINGS_MODAL_TITLE_CLASS, settingsColumnHeaderClass } from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
} from "@/components/ui";
import { cn } from "@/lib/cn";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type WeekdayRow = {
  enabled: boolean;
  value: string;
};

type Props = {
  mode: "create" | "edit";
  location: Location;
  area: LocationArea;
  shiftTypes: ShiftType[];
  staffing: LocationAreaStaffing[];
  initialShiftTypeId?: string;
  onClose: () => void;
  onSaved: () => void;
};

const STAFFING_DAY_COUNT = WEEKDAY_KEYS.length + 1;

const STAFFING_COUNT_INPUT_CLASS =
  "h-8 !w-[50px] !max-w-[50px] shrink-0 !px-0 py-0 text-center text-sm tabular-nums rounded-full";

type StaffingDayRowProps = {
  label: string;
  row: WeekdayRow;
  open: boolean;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onValueChange: (value: string) => void;
};

function StaffingDayRow({
  label,
  row,
  open,
  disabled,
  onToggle,
  onValueChange,
}: StaffingDayRowProps) {
  const muted = !open;

  return (
    <div className="contents">
      <span className={cn("text-center text-sm", muted && "opacity-50")}>{label}</span>
      <input
        type="checkbox"
        checked={row.enabled}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className={cn("size-4 shrink-0 rounded border-border", muted && "opacity-50")}
        aria-label={label}
      />
      <Input
        value={row.value}
        disabled={disabled || !row.enabled}
        onChange={(e) => onValueChange(e.target.value)}
        inputMode="numeric"
        maxLength={2}
        placeholder="0"
        className={cn(STAFFING_COUNT_INPUT_CLASS, "justify-self-center", muted && "opacity-50")}
      />
    </div>
  );
}

function buildInitialRows(
  shiftTypeId: string | null,
  staffing: LocationAreaStaffing[]
): WeekdayRow[] {
  return Array.from({ length: STAFFING_DAY_COUNT }, (_, weekday) => {
    const rule = staffing.find(
      (s) => s.shift_type_id === shiftTypeId && s.weekday === weekday
    );
    if (rule && rule.required_count > 0) {
      return { enabled: true, value: String(rule.required_count) };
    }
    return { enabled: false, value: "" };
  });
}

function configuredShiftTypeIds(staffing: LocationAreaStaffing[]): Set<string> {
  const ids = new Set<string>();
  for (const rule of staffing) {
    if (rule.required_count > 0) ids.add(rule.shift_type_id);
  }
  return ids;
}

export function LocationStaffingFormModal({
  mode,
  location,
  area,
  shiftTypes,
  staffing,
  initialShiftTypeId,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const availableShiftTypes = useMemo(() => {
    if (mode === "edit" && initialShiftTypeId) {
      return shiftTypes.filter((type) => type.id === initialShiftTypeId);
    }
    const configured = configuredShiftTypeIds(staffing);
    return shiftTypes.filter((type) => !configured.has(type.id));
  }, [mode, initialShiftTypeId, shiftTypes, staffing]);

  const [shiftTypeId, setShiftTypeId] = useState(
    () => initialShiftTypeId ?? availableShiftTypes[0]?.id ?? ""
  );
  const [rows, setRows] = useState<WeekdayRow[]>(() =>
    buildInitialRows(initialShiftTypeId ?? availableShiftTypes[0]?.id ?? null, staffing)
  );

  function handleShiftTypeChange(nextId: string) {
    setShiftTypeId(nextId);
    setRows(buildInitialRows(nextId, staffing));
    setError(null);
  }

  function setRowEnabled(weekday: number, enabled: boolean) {
    setRows((prev) =>
      prev.map((row, index) =>
        index === weekday
          ? { enabled, value: enabled ? row.value : "" }
          : row
      )
    );
  }

  function setRowValue(weekday: number, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setRows((prev) =>
      prev.map((row, index) => (index === weekday ? { ...row, value: digits } : row))
    );
  }

  function handleSubmit() {
    setError(null);
    if (!shiftTypeId) {
      setError(t("locations.staffingSelectShiftType"));
      return;
    }

    const rules: { weekday: number; required_count: number }[] = [];
    let hasEnabled = false;

    for (let weekday = 0; weekday < STAFFING_DAY_COUNT; weekday++) {
      const row = rows[weekday];
      if (!row?.enabled) continue;
      hasEnabled = true;
      const trimmed = row.value.trim();
      if (!trimmed) {
        setError(t("locations.staffingEnterCountForDay"));
        return;
      }
      const count = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(count) || count < 0 || count > 99) {
        setError(t("locations.staffingInvalidCount"));
        return;
      }
      rules.push({ weekday, required_count: count });
    }

    if (!hasEnabled) {
      setError(t("locations.staffingSelectAtLeastOneDay"));
      return;
    }

    startTransition(async () => {
      const result = await saveShiftTypeStaffing({
        locationId: location.id,
        locationAreaId: area.id,
        shiftTypeId,
        rules,
      });
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
        aria-labelledby="location-staffing-form-title"
        className="relative z-[71] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id="location-staffing-form-title"
                className={SETTINGS_MODAL_TITLE_CLASS}
              >
                {mode === "create"
                  ? t("locations.staffingCreateTitle")
                  : t("locations.staffingEditTitle")}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {t("locations.staffingFormFor", {
                  location: location.name,
                  area: area.name,
                })}
              </p>
            </div>
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
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("locations.staffingShiftType")}</LabelMuted>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={shiftTypeId}
              disabled={pending || mode === "edit" || availableShiftTypes.length === 0}
              onChange={(e) => handleShiftTypeChange(e.target.value)}
            >
              {availableShiftTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-full justify-center">
            <div className="grid w-[13.5rem] grid-cols-3 items-center justify-items-center gap-x-3 gap-y-2">
              <span className={cn(settingsColumnHeaderClass("center"), "w-full px-0")}>
                {t("locations.staffingFormColumnDay")}
              </span>
              <span className={cn(settingsColumnHeaderClass("center"), "w-full px-0")}>
                {t("locations.staffingFormColumnActive")}
              </span>
              <span className={cn(settingsColumnHeaderClass("center"), "w-full px-0")}>
                {t("locations.staffingFormColumnCount")}
              </span>
              {WEEKDAY_KEYS.map((key, weekday) => {
                const row = rows[weekday]!;
                const open = isStaffingDayEnabled(location, weekday);
                const disabled = pending || !open;
                return (
                  <StaffingDayRow
                    key={key}
                    label={t(`locations.weekdays.${key}`).slice(0, 2)}
                    row={row}
                    open={open}
                    disabled={disabled}
                    onToggle={(enabled) => setRowEnabled(weekday, enabled)}
                    onValueChange={(value) => setRowValue(weekday, value)}
                  />
                );
              })}
              {(() => {
                const weekday = STAFFING_HOLIDAY_WEEKDAY;
                const row = rows[weekday]!;
                const open = isStaffingDayEnabled(location, weekday);
                const disabled = pending || !open;
                return (
                  <StaffingDayRow
                    key="holiday"
                    label={t("locations.weekdays.holiday")}
                    row={row}
                    open={open}
                    disabled={disabled}
                    onToggle={(enabled) => setRowEnabled(weekday, enabled)}
                    onValueChange={(value) => setRowValue(weekday, value)}
                  />
                );
              })()}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={pending || !shiftTypeId}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
