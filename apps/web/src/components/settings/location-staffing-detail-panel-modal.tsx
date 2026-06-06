"use client";

import { useMemo, useState } from "react";
import { saveShiftTypeStaffing } from "@/app/actions/location-staffing";
import {
  isStaffingDayEnabled,
  STAFFING_HOLIDAY_WEEKDAY,
} from "@/lib/location-staffing-client";
import type {
  Location,
  LocationArea,
  LocationAreaStaffing,
  Qualification,
  ShiftType,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import { useTranslations } from "@/i18n/locale-provider";
import { SETTINGS_MODAL_TITLE_CLASS } from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
  TrashIcon,
} from "@/components/ui";
const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const STAFFING_DAY_COUNT = WEEKDAY_KEYS.length + 1;

type QualRow = {
  key: string;
  qualification_id: string;
  count: string;
};

type DayBlock = {
  weekday: number;
  rows: QualRow[];
};

let rowKeyCounter = 0;
function nextRowKey() {
  rowKeyCounter += 1;
  return `staff-row-${rowKeyCounter}`;
}

function weekdayLabel(
  weekday: number,
  t: (key: string) => string
): string {
  if (weekday === STAFFING_HOLIDAY_WEEKDAY) {
    return t("locations.weekdays.holiday");
  }
  return t(`locations.weekdays.${WEEKDAY_KEYS[weekday]!}`);
}

function openWeekdays(
  serviceHours: AreaServiceHourRef[],
  areaId: string
): number[] {
  const days: number[] = [];
  for (let weekday = 0; weekday < STAFFING_DAY_COUNT; weekday++) {
    if (isStaffingDayEnabled(serviceHours, areaId, weekday)) {
      days.push(weekday);
    }
  }
  return days;
}

function buildInitialBlocks(
  shiftTypeId: string,
  staffing: LocationAreaStaffing[],
  serviceHours: AreaServiceHourRef[],
  areaId: string
): DayBlock[] {
  return openWeekdays(serviceHours, areaId).map((weekday) => ({
    weekday,
    rows: staffing
      .filter((s) => s.shift_type_id === shiftTypeId && s.weekday === weekday)
      .map((s) => ({
        key: s.id,
        qualification_id: s.qualification_id,
        count: String(s.required_count),
      })),
  }));
}

function configuredShiftTypeIds(staffing: LocationAreaStaffing[]): Set<string> {
  const ids = new Set<string>();
  for (const rule of staffing) {
    if (rule.required_count > 0) ids.add(rule.shift_type_id);
  }
  return ids;
}

const COUNT_INPUT_CLASS =
  "h-8 !w-[3.25rem] shrink-0 px-0 text-center text-sm tabular-nums";

type Props = {
  mode: "create" | "edit";
  location: Location;
  area: LocationArea;
  serviceHours: AreaServiceHourRef[];
  shiftTypes: ShiftType[];
  qualifications: Qualification[];
  staffing: LocationAreaStaffing[];
  initialShiftTypeId?: string;
  onClose: () => void;
  onSaved: (createdShiftTypeId?: string) => void;
};

export function LocationStaffingDetailPanelModal({
  mode,
  location,
  area,
  serviceHours,
  shiftTypes,
  qualifications,
  staffing,
  initialShiftTypeId,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [saving, setSaving] = useState(false);
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
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>(() =>
    buildInitialBlocks(
      initialShiftTypeId ?? availableShiftTypes[0]?.id ?? "",
      staffing,
      serviceHours,
      area.id
    )
  );

  const selectedShiftType = shiftTypes.find((type) => type.id === shiftTypeId);

  function handleShiftTypeChange(nextId: string) {
    setShiftTypeId(nextId);
    setDayBlocks(buildInitialBlocks(nextId, staffing, serviceHours, area.id));
    setError(null);
  }

  function updateDayBlocks(updater: (blocks: DayBlock[]) => DayBlock[]) {
    setDayBlocks((prev) => updater(prev));
  }

  function addRow(weekday: number) {
    const defaultQual = qualifications.find(
      (q) =>
        !dayBlocks
          .find((b) => b.weekday === weekday)
          ?.rows.some((r) => r.qualification_id === q.id)
    );
    if (!defaultQual) return;
    updateDayBlocks((blocks) =>
      blocks.map((block) =>
        block.weekday === weekday
          ? {
              ...block,
              rows: [
                ...block.rows,
                {
                  key: nextRowKey(),
                  qualification_id: defaultQual.id,
                  count: "1",
                },
              ],
            }
          : block
      )
    );
  }

  function removeRow(weekday: number, key: string) {
    updateDayBlocks((blocks) =>
      blocks.map((block) =>
        block.weekday === weekday
          ? { ...block, rows: block.rows.filter((r) => r.key !== key) }
          : block
      )
    );
  }

  function setQualification(weekday: number, key: string, qualificationId: string) {
    updateDayBlocks((blocks) =>
      blocks.map((block) =>
        block.weekday === weekday
          ? {
              ...block,
              rows: block.rows.map((r) =>
                r.key === key ? { ...r, qualification_id: qualificationId } : r
              ),
            }
          : block
      )
    );
  }

  function setCount(weekday: number, key: string, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    updateDayBlocks((blocks) =>
      blocks.map((block) =>
        block.weekday === weekday
          ? {
              ...block,
              rows: block.rows.map((r) =>
                r.key === key ? { ...r, count: digits } : r
              ),
            }
          : block
      )
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!shiftTypeId) {
      setError(t("locations.staffingSelectShiftType"));
      return;
    }
    if (!qualifications.length) {
      setError(t("locations.staffingNoQualifications"));
      return;
    }

    const rules: {
      weekday: number;
      qualification_id: string;
      required_count: number;
    }[] = [];

    for (const block of dayBlocks) {
      for (const row of block.rows) {
        const trimmed = row.count.trim();
        if (!trimmed) {
          setError(t("locations.staffingEnterCountForDay"));
          return;
        }
        const count = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(count) || count < 1 || count > 99) {
          setError(t("locations.staffingInvalidCount"));
          return;
        }
        if (!row.qualification_id) {
          setError(t("locations.staffingSelectQualification"));
          return;
        }
        rules.push({
          weekday: block.weekday,
          qualification_id: row.qualification_id,
          required_count: count,
        });
      }
    }

    setSaving(true);
    try {
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
      onSaved(mode === "create" ? shiftTypeId : undefined);
      onClose();
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const title =
    mode === "create"
      ? t("locations.staffingCreateTitle")
      : selectedShiftType
        ? t("locations.staffingDetailTitle", { shift: selectedShiftType.name })
        : t("locations.staffingEditTitle");

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-staffing-detail-title"
        className="relative z-[71] flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 id="location-staffing-detail-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {title}
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
            disabled={saving}
            aria-label={t("common.close")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {error && <Alert variant="error" className="mb-3">{error}</Alert>}

          {mode === "create" && (
            <div className="mb-4">
              <LabelMuted>{t("locations.staffingShiftType")}</LabelMuted>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={shiftTypeId}
                disabled={saving || availableShiftTypes.length === 0}
                onChange={(e) => handleShiftTypeChange(e.target.value)}
              >
                {availableShiftTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {qualifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {t("locations.staffingNoQualifications")}
            </p>
          ) : dayBlocks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {t("locations.staffingNoOpenDays")}
            </p>
          ) : (
            <div className="space-y-4">
              {dayBlocks.map((block) => {
                const usedIds = new Set(block.rows.map((r) => r.qualification_id));
                const canAdd = qualifications.some((q) => !usedIds.has(q.id));
                return (
                  <section key={block.weekday}>
                    <p className="mb-1.5 text-sm font-semibold text-foreground">
                      {weekdayLabel(block.weekday, t)}
                    </p>
                    {block.rows.length === 0 ? (
                      <p className="mb-1 text-xs text-muted">
                        {t("locations.staffingDayEmpty")}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {block.rows.map((row) => (
                          <div
                            key={row.key}
                            className="flex items-center gap-2"
                          >
                            <select
                              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                              value={row.qualification_id}
                              disabled={saving}
                              onChange={(e) =>
                                setQualification(
                                  block.weekday,
                                  row.key,
                                  e.target.value
                                )
                              }
                            >
                              {qualifications.map((q) => (
                                <option
                                  key={q.id}
                                  value={q.id}
                                  disabled={
                                    usedIds.has(q.id) &&
                                    q.id !== row.qualification_id
                                  }
                                >
                                  {q.name}
                                </option>
                              ))}
                            </select>
                            <Input
                              value={row.count}
                              disabled={saving}
                              onChange={(e) =>
                                setCount(block.weekday, row.key, e.target.value)
                              }
                              inputMode="numeric"
                              maxLength={2}
                              className={COUNT_INPUT_CLASS}
                              aria-label={t("locations.staffingFormColumnCount")}
                            />
                            <IconButton
                              size="sm"
                              disabled={saving}
                              className="border border-border"
                              aria-label={t("common.delete")}
                              onClick={() => removeRow(block.weekday, row.key)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || !canAdd}
                      className="mt-1.5 h-7 text-xs"
                      onClick={() => addRow(block.weekday)}
                    >
                      {t("locations.staffingAddQualification")}
                    </Button>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={
              saving ||
              !shiftTypeId ||
              !qualifications.length ||
              dayBlocks.length === 0
            }
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
