"use client";

import {
  SettingsListRowDeleteButton,
} from "@/components/settings/settings-list-ui";
import type { WeekTemporaryStaffingEntry } from "@/lib/week-temporary-staffing-entries";
import { nextWeekTemporaryQualRowKey } from "@/lib/week-temporary-staffing-entries";
import type {
  AreaShiftTemplateWithBreaks,
  Qualification,
} from "@schichtwerk/types";
import { cn } from "@/lib/cn";
import {
  Button,
  Input,
  Select,
  TimeInput,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";

const FIELD_CLASS = "h-8 min-h-8 py-0 text-sm leading-8";
const TIME_INPUT_CLASS = "h-8 w-full min-w-[9.5rem] shrink-0 px-2 tabular-nums";
const COUNT_INPUT_CLASS =
  "h-8 !w-[3.25rem] shrink-0 px-0 text-center text-sm tabular-nums";
/** Sichtbare Schichtzeilen vor Scroll (ab 4. Eintrag). */
const VISIBLE_SHIFT_ROWS = 3;
/** Kopfzeile + Zeilenhöhe (Vorlage, Zeiten, eine Tätigkeit + Button). */
const STAFFING_TABLE_SCROLL_MAX_HEIGHT = "max-h-[calc(2rem+3*4.75rem)]";

type Props = {
  entries: WeekTemporaryStaffingEntry[];
  shiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  disabled?: boolean;
  templateColumnLabel: string;
  fromColumnLabel: string;
  toColumnLabel: string;
  qualificationsColumnLabel: string;
  selectTemplateLabel: string;
  addQualificationLabel: string;
  addShiftLabel: string;
  deleteLabel: string;
  countAriaLabel: string;
  onChange: (entries: WeekTemporaryStaffingEntry[]) => void;
  onAddShift: () => void;
};

export function CalendarWeekStaffingEntriesTable({
  entries,
  shiftTemplates,
  qualifications,
  disabled,
  templateColumnLabel,
  fromColumnLabel,
  toColumnLabel,
  qualificationsColumnLabel,
  selectTemplateLabel,
  addQualificationLabel,
  addShiftLabel,
  deleteLabel,
  countAriaLabel,
  onChange,
  onAddShift,
}: Props) {
  function updateEntry(
    entryKey: string,
    patch: Partial<Pick<WeekTemporaryStaffingEntry, "templateId" | "startTime" | "endTime">>
  ) {
    onChange(
      entries.map((entry) =>
        entry.key === entryKey ? { ...entry, ...patch } : entry
      )
    );
  }

  function handleTemplateChange(entryKey: string, templateId: string) {
    const template = shiftTemplates.find((item) => item.id === templateId);
    if (!template) {
      updateEntry(entryKey, { templateId });
      return;
    }
    updateEntry(entryKey, {
      templateId,
      startTime: template.start_time.slice(0, 5),
      endTime: template.end_time.slice(0, 5),
    });
  }

  function updateQualification(
    entryKey: string,
    qualKey: string,
    qualificationId: string
  ) {
    onChange(
      entries.map((entry) =>
        entry.key === entryKey
          ? {
              ...entry,
              qualifications: entry.qualifications.map((row) =>
                row.key === qualKey ? { ...row, qualification_id: qualificationId } : row
              ),
            }
          : entry
      )
    );
  }

  function updateCount(entryKey: string, qualKey: string, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    onChange(
      entries.map((entry) =>
        entry.key === entryKey
          ? {
              ...entry,
              qualifications: entry.qualifications.map((row) =>
                row.key === qualKey ? { ...row, count: digits } : row
              ),
            }
          : entry
      )
    );
  }

  function addQualification(entryKey: string) {
    const usedIds = new Set(
      entries
        .find((entry) => entry.key === entryKey)
        ?.qualifications.map((row) => row.qualification_id) ?? []
    );
    const nextQual = qualifications.find((qual) => !usedIds.has(qual.id));
    if (!nextQual) return;
    onChange(
      entries.map((entry) =>
        entry.key === entryKey
          ? {
              ...entry,
              qualifications: [
                ...entry.qualifications,
                {
                  key: nextWeekTemporaryQualRowKey(),
                  qualification_id: nextQual.id,
                  count: "1",
                },
              ],
            }
          : entry
      )
    );
  }

  function removeQualification(entryKey: string, qualKey: string) {
    onChange(
      entries.map((entry) =>
        entry.key === entryKey
          ? {
              ...entry,
              qualifications: entry.qualifications.filter(
                (row) => row.key !== qualKey
              ),
            }
          : entry
      )
    );
  }

  function removeEntry(entryKey: string) {
    onChange(entries.filter((entry) => entry.key !== entryKey));
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "rounded-md border border-border/60",
          entries.length > VISIBLE_SHIFT_ROWS &&
            cn(STAFFING_TABLE_SCROLL_MAX_HEIGHT, "overflow-y-auto modal-scrollbar")
        )}
      >
        <table className="w-full min-w-0 text-sm">
          <thead className="sticky top-0 z-[1] border-b border-border bg-surface">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-medium text-muted">
                {templateColumnLabel}
              </th>
              <th className="px-2 py-1.5 text-center font-medium text-muted">
                {fromColumnLabel}
              </th>
              <th className="px-2 py-1.5 text-center font-medium text-muted">
                {toColumnLabel}
              </th>
              <th className="px-2 py-1.5 font-medium text-muted">
                {qualificationsColumnLabel}
              </th>
              <th className="w-8 px-1 py-1.5" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const usedQualIds = new Set(
                entry.qualifications.map((row) => row.qualification_id)
              );
              return (
                <tr key={entry.key} className="border-b border-border/50 last:border-b-0">
                  <td className="px-2 py-1.5 align-top">
                    <Select
                      className={cn(
                        FIELD_CLASS,
                        "w-full min-w-0",
                        !entry.templateId && "text-[silver]"
                      )}
                      value={entry.templateId}
                      disabled={disabled || shiftTemplates.length === 0}
                      aria-label={templateColumnLabel}
                      onChange={(event) =>
                        handleTemplateChange(entry.key, event.target.value)
                      }
                    >
                      <option value="">{selectTemplateLabel}</option>
                      {shiftTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <TimeInput
                      value={entry.startTime}
                      disabled={disabled}
                      aria-label={fromColumnLabel}
                      onChange={(event) =>
                        updateEntry(entry.key, { startTime: event.target.value })
                      }
                      className={TIME_INPUT_CLASS}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <TimeInput
                      value={entry.endTime}
                      disabled={disabled}
                      aria-label={toColumnLabel}
                      onChange={(event) =>
                        updateEntry(entry.key, { endTime: event.target.value })
                      }
                      className={TIME_INPUT_CLASS}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <div className="space-y-1">
                      {entry.qualifications.map((row) => (
                        <div
                          key={row.key}
                          className="flex min-w-0 items-center gap-1"
                        >
                          <Tooltip
                            content={
                              qualifications.find(
                                (qual) => qual.id === row.qualification_id
                              )?.name
                            }
                            className="min-w-0 flex-1"
                          >
                            <select
                              className="h-8 min-w-0 w-full truncate rounded-md border border-border bg-background px-2 text-sm"
                              value={row.qualification_id}
                              disabled={disabled}
                              onChange={(event) =>
                                updateQualification(
                                  entry.key,
                                  row.key,
                                  event.target.value
                                )
                              }
                            >
                              {qualifications.map((qual) => (
                                <option
                                  key={qual.id}
                                  value={qual.id}
                                  disabled={
                                    usedQualIds.has(qual.id) &&
                                    qual.id !== row.qualification_id
                                  }
                                >
                                  {qual.name}
                                </option>
                              ))}
                            </select>
                          </Tooltip>
                          <Input
                            value={row.count}
                            disabled={disabled}
                            onChange={(event) =>
                              updateCount(entry.key, row.key, event.target.value)
                            }
                            inputMode="numeric"
                            maxLength={2}
                            className={COUNT_INPUT_CLASS}
                            aria-label={countAriaLabel}
                          />
                          <SettingsListRowDeleteButton
                            label={deleteLabel}
                            disabled={disabled}
                            onClick={() => removeQualification(entry.key, row.key)}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        className="h-7 text-xs"
                        onClick={() => addQualification(entry.key)}
                      >
                        {addQualificationLabel}
                      </Button>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 align-top">
                    <SettingsListRowDeleteButton
                      label={deleteLabel}
                      disabled={disabled || entries.length <= 1}
                      onClick={() => removeEntry(entry.key)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 text-xs"
          onClick={onAddShift}
        >
          {addShiftLabel}
        </Button>
      </div>
    </div>
  );
}
