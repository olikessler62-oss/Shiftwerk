"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  fetchAreaCalendarBulkShiftContext,
  type AreaCalendarEmployeeAvailabilityEntry,
  type AreaCalendarShiftAssignEmployee,
  type ProfileShiftPreferenceEntry,
} from "@/app/actions/areacalendar-shift-assign";
import { assignShiftWithTimes } from "@/app/actions/shifts";
import { resolveShiftTemplateStoredColor } from "@schichtwerk/database";
import {
  MODAL_SCROLLBAR_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  areaCalendarAlertDialogClass,
  areaCalendarNestedModalOverlayClass,
  settingsModalFooterClass,
} from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";
import {
  Alert,
  Button,
  Checkbox,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  IconButton,
  LabelMuted,
  TimeInput,
  tooltipContentClassName,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import {
  areAreaCalendarShiftTimesComplete,
  filterAreaCalendarShiftAssignEmployeesByWindowWithoutOverlap,
  profileAvailabilitiesForWeekday,
  profileAvailabilityWeekdayFromAreaCalendarDate,
} from "@/lib/available-employees-for-shift";
import { pickEmployeeForBulkPrefill } from "@/lib/bulk-shift-row-prefill";
import { computeBulkStaffingHeaderEntries } from "@/lib/bulk-staffing-header";
import { resolveAddShiftFormInitialValues } from "@/lib/bulk-shift-staffing";
import { isEmployeeWishFulfilled } from "@/lib/profile-shift-preference-matching";
import type { AreaCalendarAssignmentTimeWindow } from "@/lib/shift-overlap";
import { DEFAULT_ORGANIZATION_TIME_ZONE } from "@/lib/dates";
import {
  areaShiftTemplatesForArea,
  areaCalendarAssignmentPresetsForArea,
  resolvePresetIdFromTimes,
  areaShiftTemplateIdForAssign,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import { formatDayHeader } from "@/lib/planning-utils";
import { validateAreaCalendarShiftServiceHours } from "@/lib/service-hours-shift-validation";
import { hasRemainingAssignableWeekDates } from "@/lib/shift-assign-rest-of-week";
import {
  evaluateShiftAssignAvailabilityConflict,
  isShiftAssignAvailabilityConflictError,
  useShiftAssignAvailabilityNotice,
} from "@/lib/shift-assign-availability-notice";
import { isShiftAssignWeeklyHoursExceededError } from "@/lib/shift-assign-blocking-errors";
import {
  formatAvailabilityTimeRange,
  weekdayLabel,
  type WeekdayLabelStyle,
} from "@/lib/profile-availability-label";
import {
  COMBOBOX_TOOLTIP_CLOSE_DISTANCE_PX,
  distanceFromPointToRect,
  EMPLOYEE_AVAILABILITY_HINT_AUTO_CLOSE_MS,
  resolveMouseTooltipPosition,
  resolveNameHoverTooltipPosition,
  type MousePoint,
} from "@/lib/mouse-tooltip-position";
import { useComboboxCloseOnPointerDistance } from "@/lib/use-combobox-close";
import { shiftColorStyle } from "@/lib/shift-color-style";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures } from "@/lib/org-features-provider";
import { useSimulatedProposedOnAssignRequest } from "@/lib/shift-confirmation-simulation-context";
import { translateActionError } from "@/lib/translate-action-error";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";

const EMPTY_EMPLOYEE_ID = "";
export { EMPTY_EMPLOYEE_ID as AREA_CALENDAR_EMPTY_EMPLOYEE_ID };
const DASHBOARD_COMBOBOX_DROPDOWN_Z = 120;

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

function useFloatingDropdownPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>
): DropdownPosition | null {
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  return position;
}

type MenuPosition = MousePoint;

function availabilityTimeLabel(
  entry: AreaCalendarEmployeeAvailabilityEntry,
  locale: "de" | "en"
): string {
  return formatAvailabilityTimeRange(
    entry.start_time,
    entry.end_time,
    locale
  ).replace(" – ", " - ");
}

function formatAvailabilityMenuLabel(
  entry: AreaCalendarEmployeeAvailabilityEntry,
  locale: "de" | "en",
  weekdayStyle: WeekdayLabelStyle
): string {
  return `${weekdayLabel(entry.weekday, locale, weekdayStyle)}: ${availabilityTimeLabel(entry, locale)}`;
}

type EmployeeAvailabilityHintProps = {
  employeeName: string;
  availabilities: AreaCalendarEmployeeAvailabilityEntry[];
  anchorEl: HTMLElement | null;
  tooltipRef: RefObject<HTMLDivElement | null>;
  weekdayLabelStyle: WeekdayLabelStyle;
};

function EmployeeAvailabilityHint({
  employeeName,
  availabilities,
  anchorEl,
  tooltipRef,
  weekdayLabelStyle,
}: EmployeeAvailabilityHintProps) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const node = tooltipRef.current;
    if (!anchorEl || !node) return;

    const updatePosition = () => {
      const comboboxRect = anchorEl.getBoundingClientRect();
      const { width, height } = node.getBoundingClientRect();
      setPosition(
        resolveNameHoverTooltipPosition(comboboxRect, width, height)
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorEl, tooltipRef, availabilities, employeeName, localeKey, t]);

  return createPortal(
    <div
      ref={tooltipRef}
      className={cn(tooltipContentClassName, "fixed z-[120] w-max max-w-[calc(100vw-1rem)]")}
      style={{ top: position.y, left: position.x }}
      role="tooltip"
    >
      <p className="mb-1.5 border-b border-border/60 pb-1.5 text-xs font-semibold text-foreground">
        {employeeName}
      </p>
      <p className="mb-1.5 text-xs font-semibold text-foreground">
        {t("profiles.panelAvailability")}
      </p>
      {availabilities.length === 0 ? (
        <p className="text-xs text-muted">{t("profiles.emptyAvailability")}</p>
      ) : (
        <ul
          className="space-y-1 text-xs"
          role="list"
        >
          {availabilities.map((entry, index) => (
            <li
              key={`${entry.weekday}-${entry.start_time}-${entry.end_time}-${index}`}
            >
              {formatAvailabilityMenuLabel(entry, localeKey, weekdayLabelStyle)}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  );
}

type EmployeeAvailabilityContextMenuProps = {
  availabilities: AreaCalendarEmployeeAvailabilityEntry[];
  anchor: MousePoint;
  onSelect: (entry: AreaCalendarEmployeeAvailabilityEntry) => void;
  onClose: () => void;
  weekdayLabelStyle: WeekdayLabelStyle;
};

function EmployeeAvailabilityContextMenu({
  availabilities,
  anchor,
  onSelect,
  onClose,
  weekdayLabelStyle,
}: EmployeeAvailabilityContextMenuProps) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>(anchor);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition(
      resolveMouseTooltipPosition(anchor.x, anchor.y, width, height)
    );
  }, [anchor, availabilities, localeKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[120] flex w-fit min-w-[13.75rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
      style={{
        top: position.y,
        left: position.x,
      }}
      role="menu"
      aria-label={t("profiles.panelAvailability")}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <p className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-foreground">
        {t("profiles.panelAvailability")}
      </p>
      <div className="border-t border-border">
        {availabilities.length === 0 ? (
          <p className="whitespace-nowrap px-3 py-2 text-xs text-muted">
            {t("profiles.emptyAvailability")}
          </p>
        ) : (
          availabilities.map((entry, index) => (
            <button
              key={`${entry.weekday}-${entry.start_time}-${entry.end_time}-${index}`}
              type="button"
              role="menuitem"
              className="block w-full cursor-pointer whitespace-nowrap px-3 py-1.5 text-left text-xs text-foreground hover:bg-subtle"
              onClick={() => {
                onSelect(entry);
                onClose();
              }}
            >
              {formatAvailabilityMenuLabel(
                entry,
                localeKey,
                weekdayLabelStyle
              )}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}

export type AreaCalendarAddShiftDialogState = {
  areaId: string | null;
  date: string;
};

export type AreaCalendarBulkShiftDialogState = {
  areaId: string;
  date: string;
  /** Gespeicherte Schicht — Zeile im Bulk-Modal fokussieren und scrollen. */
  focusShiftId?: string;
  /** Tag ohne Servicezeit — Bedarfsliste ausblenden, keine Servicezeit-Validierung. */
  withoutServiceHours?: boolean;
  /** Dashboard: Mitarbeiter der angeklickten Zeilen-Zelle für neue Zeilen. */
  presetEmployeeId?: string;
};

/** Schicht-hinzufügen-Dialog: Standard `max-w-md` (28rem) + 20 %. */
export const ADD_SHIFT_MODAL_MAX_WIDTH_CLASS = "max-w-[33.6rem]";

export const ADD_SHIFT_AVAILABILITY_NOTICE_CLASS =
  "mt-1 text-xs text-red-600";

function EmployeeColorSwatch({ hex }: { hex: string | null }) {
  if (!hex) {
    return (
      <span
        className="inline-block h-[10px] w-[10px] shrink-0 rounded-sm border border-border/60 bg-transparent"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-block h-[10px] w-[10px] shrink-0 rounded-sm border border-border/60"
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

type EmployeeComboboxProps = {
  value: string;
  onChange: (employeeId: string) => void;
  employees: AreaCalendarShiftAssignEmployee[];
  selectedEmployee: AreaCalendarShiftAssignEmployee | null;
  weekday: number;
  dayAvailabilities: AreaCalendarEmployeeAvailabilityEntry[];
  emptyLabel: string;
  disabled?: boolean;
  onApplyAvailability: (entry: AreaCalendarEmployeeAvailabilityEntry) => void;
  triggerClassName?: string;
  rootClassName?: string;
  weekdayLabelStyle?: WeekdayLabelStyle;
};

function availabilitiesForWeekday(
  employee: AreaCalendarShiftAssignEmployee,
  weekday: number
): AreaCalendarEmployeeAvailabilityEntry[] {
  return profileAvailabilitiesForWeekday(employee.availabilities, weekday);
}

function splitEmployeeDisplayName(fullName: string): {
  givenName: string;
  surname: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { givenName: "", surname: "" };
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace <= 0) return { givenName: "", surname: trimmed };
  return {
    givenName: `${trimmed.slice(0, lastSpace)} `,
    surname: trimmed.slice(lastSpace + 1),
  };
}

function EmployeeNameLabel({ name }: { name: string }) {
  const { givenName, surname } = splitEmployeeDisplayName(name);
  return (
    <span className="min-w-0 flex-1 truncate" data-employee-name>
      {givenName ? <span>{givenName}</span> : null}
      <span data-employee-surname>{surname || name}</span>
    </span>
  );
}

export function AreaCalendarShiftEmployeeCombobox({
  value,
  onChange,
  employees,
  selectedEmployee,
  weekday,
  dayAvailabilities,
  emptyLabel,
  disabled = false,
  onApplyAvailability,
  triggerClassName,
  rootClassName,
  weekdayLabelStyle = "short",
}: EmployeeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [hintAvailabilities, setHintAvailabilities] = useState<
    AreaCalendarEmployeeAvailabilityEntry[] | null
  >(null);
  const [hintAnchorEl, setHintAnchorEl] = useState<HTMLElement | null>(null);
  const [hintEmployeeName, setHintEmployeeName] = useState("");
  const [availabilityMenuAnchor, setAvailabilityMenuAnchor] =
    useState<MousePoint | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hintTooltipRef = useRef<HTMLDivElement>(null);
  const dropdownPosition = useFloatingDropdownPosition(open, triggerRef);
  const closeDropdown = useCallback(() => setOpen(false), []);
  useComboboxCloseOnPointerDistance(open, closeDropdown, [triggerRef, listRef]);
  const selected =
    value === EMPTY_EMPLOYEE_ID
      ? null
      : employees.find((employee) => employee.id === value) ?? selectedEmployee;

  const canShowSelectedEmployeeHint =
    !disabled &&
    !availabilityMenuAnchor &&
    selectedEmployee !== null &&
    value !== EMPTY_EMPLOYEE_ID;

  const showHint = useCallback(
    (
      availabilities: AreaCalendarEmployeeAvailabilityEntry[],
      anchorEl: HTMLElement,
      employeeName: string
    ) => {
      setHintAnchorEl(anchorEl);
      setHintEmployeeName(employeeName);
      setHintAvailabilities(availabilities);
    },
    []
  );

  const hideHint = useCallback(() => {
    setHintAvailabilities(null);
    setHintAnchorEl(null);
    setHintEmployeeName("");
  }, []);

  const closeAvailabilityMenu = useCallback(() => {
    setAvailabilityMenuAnchor(null);
  }, []);

  useEffect(() => {
    if (open) {
      closeAvailabilityMenu();
    }
  }, [open, closeAvailabilityMenu]);

  useEffect(() => {
    if (!hintAvailabilities) return;

    const autoCloseTimer = window.setTimeout(
      hideHint,
      EMPLOYEE_AVAILABILITY_HINT_AUTO_CLOSE_MS
    );

    const handleMouseMove = (event: MouseEvent) => {
      const comboboxEl = rootRef.current;
      if (!comboboxEl) return;

      const nearCombobox =
        distanceFromPointToRect(
          event.clientX,
          event.clientY,
          comboboxEl.getBoundingClientRect()
        ) <= COMBOBOX_TOOLTIP_CLOSE_DISTANCE_PX;

      const nearDropdown =
        open &&
        listRef.current &&
        distanceFromPointToRect(
          event.clientX,
          event.clientY,
          listRef.current.getBoundingClientRect()
        ) <= COMBOBOX_TOOLTIP_CLOSE_DISTANCE_PX;

      const overTooltip =
        hintTooltipRef.current?.contains(event.target as Node) ?? false;

      if (!nearCombobox && !nearDropdown && !overTooltip) {
        hideHint();
      }
    };

    const handleScroll = () => hideHint();

    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.clearTimeout(autoCloseTimer);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [hintAvailabilities, open, hideHint]);

  const options = useMemo(
    () => [
      ...employees,
      {
        id: EMPTY_EMPLOYEE_ID,
        full_name: emptyLabel,
        color: null,
        last_shift_date: null,
        availabilities: [],
      } satisfies AreaCalendarShiftAssignEmployee,
    ],
    [employees, emptyLabel]
  );

  return (
    <div
      ref={rootRef}
      className={cn("relative", !rootClassName && "mt-1", rootClassName)}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "box-border flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-left text-sm",
          rootClassName ? "h-full min-h-0 max-h-full py-0" : "h-9 min-h-9 py-0",
          value === EMPTY_EMPLOYEE_ID ? "text-[silver]" : "text-black",
          disabled && "cursor-not-allowed opacity-60",
          triggerClassName
        )}
        onMouseEnter={() => {
          if (!canShowSelectedEmployeeHint || open || !selected || !triggerRef.current) {
            return;
          }
          showHint(dayAvailabilities, triggerRef.current, selected.full_name);
        }}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        onContextMenu={(event) => {
          if (
            disabled ||
            !selectedEmployee ||
            value === EMPTY_EMPLOYEE_ID
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          hideHint();
          setAvailabilityMenuAnchor({ x: event.clientX, y: event.clientY });
        }}
      >
        <EmployeeColorSwatch hex={selected?.color ?? null} />
        <EmployeeNameLabel name={selected?.full_name ?? emptyLabel} />
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && dropdownPosition
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              className="fixed max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-0.5 shadow-lg"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: DASHBOARD_COMBOBOX_DROPDOWN_Z,
              }}
            >
              {options.map((employee) => (
                <li key={employee.id || "empty"} role="option" aria-selected={value === employee.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm hover:bg-subtle"
                    onMouseEnter={(event) => {
                      if (!employee.id) return;
                      showHint(
                        availabilitiesForWeekday(employee, weekday),
                        event.currentTarget,
                        employee.full_name
                      );
                    }}
                    onClick={() => {
                      onChange(employee.id);
                      setOpen(false);
                    }}
                  >
                    <EmployeeColorSwatch hex={employee.color} />
                    <EmployeeNameLabel name={employee.full_name} />
                    {value === employee.id ? (
                      <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
      {hintAvailabilities ? (
        <EmployeeAvailabilityHint
          employeeName={hintEmployeeName}
          availabilities={hintAvailabilities}
          anchorEl={hintAnchorEl}
          tooltipRef={hintTooltipRef}
          weekdayLabelStyle={weekdayLabelStyle}
        />
      ) : null}
      {availabilityMenuAnchor ? (
        <EmployeeAvailabilityContextMenu
          availabilities={dayAvailabilities}
          anchor={availabilityMenuAnchor}
          onSelect={onApplyAvailability}
          onClose={closeAvailabilityMenu}
          weekdayLabelStyle={weekdayLabelStyle}
        />
      ) : null}
    </div>
  );
}

type ShiftTypeComboboxProps = {
  value: string;
  onChange: (presetId: string) => void;
  presets: AreaCalendarAssignmentPreset[];
  placeholder: string;
  disabled?: boolean;
  rootClassName?: string;
  triggerClassName?: string;
};

export const DASHBOARD_TABLE_COMBO_TRIGGER_CLASS = "gap-1.5 px-2";
export const DASHBOARD_COMBO_EMPTY_LABEL = "—";

function ShiftPresetColorSwatch({
  name,
  color,
  empty = false,
}: {
  name?: string;
  color?: string;
  empty?: boolean;
}) {
  if (empty || !color) {
    return (
      <span
        className="box-border inline-block h-3 w-3 shrink-0 border border-border bg-transparent"
        aria-hidden
      />
    );
  }

  return (
    <span
      className="box-border inline-block h-3 w-3 shrink-0 border border-black"
      style={shiftColorStyle(resolveShiftTemplateStoredColor(name ?? "", color))}
      aria-hidden
    />
  );
}

export function AreaCalendarShiftTypeCombobox({
  value,
  onChange,
  presets,
  placeholder,
  disabled = false,
  rootClassName,
  triggerClassName,
}: ShiftTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownPosition = useFloatingDropdownPosition(open, triggerRef);
  const closeDropdown = useCallback(() => setOpen(false), []);
  useComboboxCloseOnPointerDistance(open, closeDropdown, [triggerRef, listRef]);
  const selectedType = presets.find((type) => type.id === value) ?? null;
  const isPlaceholder = !value;
  const displayText = selectedType?.name ?? placeholder;
  const showTriggerTooltip = !rootClassName;

  return (
    <div
      className={cn("relative", !rootClassName && "mt-1", rootClassName)}
    >
      <Tooltip
        content={selectedType?.name}
        className="h-full w-full min-w-0"
        disabled={!showTriggerTooltip || !selectedType || open}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "box-border flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-left text-sm",
            rootClassName ? "h-full min-h-0 max-h-full py-0" : "h-9 min-h-9 py-0",
            isPlaceholder ? "text-[silver]" : "text-black",
            disabled && "cursor-not-allowed opacity-60",
            triggerClassName
          )}
          onClick={() => {
            if (!disabled) setOpen((prev) => !prev);
          }}
        >
        {selectedType ? (
          <ShiftPresetColorSwatch
            name={selectedType.name}
            color={selectedType.color}
          />
        ) : (
          <ShiftPresetColorSwatch empty />
        )}
        <span className="min-w-0 flex-1 truncate">{displayText}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>
      </Tooltip>
      {open && dropdownPosition
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              className="fixed max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-0.5 shadow-lg"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: DASHBOARD_COMBOBOX_DROPDOWN_Z,
              }}
            >
              {presets.map((type) => (
                <li key={type.id} role="option" aria-selected={value === type.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm text-black hover:bg-subtle"
                    onClick={() => {
                      onChange(type.id);
                      setOpen(false);
                    }}
                  >
                    <ShiftPresetColorSwatch name={type.name} color={type.color} />
                    <span className="min-w-0 flex-1 truncate">{type.name}</span>
                    {value === type.id ? (
                      <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                </li>
              ))}
              <li role="option" aria-selected={isPlaceholder}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm text-[silver] hover:bg-subtle"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <ShiftPresetColorSwatch empty />
                  <span className="min-w-0 flex-1 truncate">{placeholder}</span>
                  {isPlaceholder ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              </li>
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}

type QualificationComboboxProps = {
  value: string;
  onChange: (qualificationId: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
  rootClassName?: string;
  triggerClassName?: string;
};

export function AreaCalendarQualificationCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  rootClassName,
  triggerClassName,
}: QualificationComboboxProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownPosition = useFloatingDropdownPosition(open, triggerRef);
  const closeDropdown = useCallback(() => setOpen(false), []);
  useComboboxCloseOnPointerDistance(open, closeDropdown, [triggerRef, listRef]);
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const isPlaceholder = !value;
  const displayText = selectedOption?.name ?? placeholder;
  const showTriggerTooltip = !rootClassName;

  return (
    <div
      className={cn("relative", !rootClassName && "mt-1", rootClassName)}
    >
      <Tooltip
        content={selectedOption?.name}
        className="h-full w-full min-w-0"
        disabled={!showTriggerTooltip || !selectedOption || open}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "box-border flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-left text-sm",
            rootClassName ? "h-full min-h-0 max-h-full py-0" : "h-9 min-h-9 py-0",
            isPlaceholder ? "text-[silver]" : "text-black",
            disabled && "cursor-not-allowed opacity-60",
            triggerClassName
          )}
          onClick={() => {
            if (!disabled) setOpen((prev) => !prev);
          }}
        >
        <EmployeeColorSwatch hex={null} />
        <span className="min-w-0 flex-1 truncate">{displayText}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>
      </Tooltip>
      {open && dropdownPosition
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              className="fixed max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-0.5 shadow-lg"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: DASHBOARD_COMBOBOX_DROPDOWN_Z,
              }}
            >
              {options.map((option) => (
                <li key={option.id} role="option" aria-selected={value === option.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm text-black hover:bg-subtle"
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                  >
                    <EmployeeColorSwatch hex={null} />
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    {value === option.id ? (
                      <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                </li>
              ))}
              <li role="option" aria-selected={isPlaceholder}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm text-[silver] hover:bg-subtle"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <EmployeeColorSwatch hex={null} />
                  <span className="min-w-0 flex-1 truncate">{placeholder}</span>
                  {isPlaceholder ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              </li>
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

type AddShiftModalProps = {
  dialog: AreaCalendarAddShiftDialogState;
  locationId: string;
  areas: LocationArea[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  serviceHours: AreaServiceHourRef[];
  staffingRules?: LocationAreaStaffing[];
  qualifications?: Qualification[];
  profileQualificationIds?: Record<string, string[]>;
  areaExistingAssignments: AreaCalendarAssignmentTimeWindow[];
  weekDates: readonly string[];
  onClose: () => void;
  onSaved?: () => void;
};

function buildProfileQualificationIdsMap(
  profileQualificationIds: Record<string, string[]> | undefined
): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  if (!profileQualificationIds) return map;
  for (const [profileId, ids] of Object.entries(profileQualificationIds)) {
    map.set(profileId, new Set(ids));
  }
  return map;
}

export function AreaCalendarAddShiftModal({
  dialog,
  locationId,
  areas,
  areaShiftTemplates,
  serviceHours,
  staffingRules = [],
  qualifications = [],
  profileQualificationIds = {},
  areaExistingAssignments,
  weekDates,
  onClose,
  onSaved,
}: AddShiftModalProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const features = useOrgFeatures();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();
  const simplePlanning = !features.areas;
  const intlLocale = toIntlLocale(locale);
  const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(dialog.date);

  const areaName =
    dialog.areaId != null
      ? (areas.find((area) => area.id === dialog.areaId)?.name ?? "")
      : "";
  const dayHeader = formatDayHeader(dialog.date, intlLocale);

  const templatesForArea = useMemo(
    () =>
      dialog.areaId
        ? areaShiftTemplatesForArea(dialog.areaId, areaShiftTemplates)
        : [],
    [areaShiftTemplates, dialog.areaId]
  );
  const assignmentPresets = useMemo(
    () => areaCalendarAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );
  const profileQualificationIdsMap = useMemo(
    () => buildProfileQualificationIdsMap(profileQualificationIds),
    [profileQualificationIds]
  );
  const staffingEntries = useMemo(() => {
    if (simplePlanning || !dialog.areaId || staffingRules.length === 0) {
      return [];
    }
    return computeBulkStaffingHeaderEntries({
      staffingRules,
      areaId: dialog.areaId,
      dateISO: dialog.date,
      serviceHours,
      assignments: areaExistingAssignments.map((assignment) => ({
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        employeeId: assignment.employeeId,
      })),
      assignmentPresets,
      qualifications,
      profileQualificationIds: profileQualificationIdsMap,
      formatTimeLabel: (_weekdayLabel, startTime, endTime) =>
        `${startTime} – ${endTime}`,
      weekdayLabel: (weekdayIndex) =>
        weekdayLabel(weekdayIndex, locale === "en" ? "en" : "de", "short"),
    });
  }, [
    simplePlanning,
    dialog.areaId,
    dialog.date,
    staffingRules,
    serviceHours,
    areaExistingAssignments,
    assignmentPresets,
    qualifications,
    profileQualificationIdsMap,
    locale,
  ]);
  const initialShiftForm = useMemo(
    () =>
      resolveAddShiftFormInitialValues({
        areaId: dialog.areaId,
        assignmentPresets,
        staffingEntries,
        serviceHours,
        staffingRules,
      }),
    [
      dialog.areaId,
      assignmentPresets,
      staffingEntries,
      serviceHours,
      staffingRules,
    ]
  );
  const presetPlaceholder = t("areaCalendar.selectShiftTemplate");
  const presetLabel = t("areaCalendar.shiftTemplateLabel");

  const [shiftTypeId, setShiftTypeId] = useState(initialShiftForm.shiftTypeId);
  const [startTime, setStartTime] = useState(initialShiftForm.startTime);
  const [endTime, setEndTime] = useState(initialShiftForm.endTime);
  const [employees, setEmployees] = useState<AreaCalendarShiftAssignEmployee[]>([]);
  const [profileShiftPreferences, setProfileShiftPreferences] = useState<
    Record<string, ProfileShiftPreferenceEntry[]>
  >({});
  const [timeZone, setTimeZone] = useState(DEFAULT_ORGANIZATION_TIME_ZONE);
  const [employeeId, setEmployeeId] = useState(EMPTY_EMPLOYEE_ID);
  const [employeeManuallySelected, setEmployeeManuallySelected] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);
  const [outsideServiceHoursConfirm, setOutsideServiceHoursConfirm] =
    useState(false);
  const [availabilityConflictPrompt, setAvailabilityConflictPrompt] =
    useState(false);
  const [weeklyHoursAlertMessage, setWeeklyHoursAlertMessage] = useState<
    string | null
  >(null);
  const [assignRestOfWeekDays, setAssignRestOfWeekDays] = useState(false);
  const skipShiftTypeFromTimesSyncRef = useRef(false);

  const showAssignRestOfWeekDaysOption =
    !simplePlanning &&
    hasRemainingAssignableWeekDates(dialog.date, weekDates);

  const timesComplete = areAreaCalendarShiftTimesComplete(startTime, endTime);

  const matchingEmployees = useMemo(
    () =>
      filterAreaCalendarShiftAssignEmployeesByWindowWithoutOverlap(
        employees,
        weekday,
        startTime,
        endTime,
        dialog.date,
        areaExistingAssignments,
        timeZone
      ),
    [
      employees,
      weekday,
      startTime,
      endTime,
      dialog.date,
      areaExistingAssignments,
      timeZone,
    ]
  );

  const availabilityNotice = useShiftAssignAvailabilityNotice({
    weekday,
    startTime,
    endTime,
    employeeId,
    emptyEmployeeId: EMPTY_EMPLOYEE_ID,
    employees,
    loadingEmployees,
    assignmentPresets,
    shiftTypeId,
    timesComplete,
  });

  const showAvailabilityConflictFeedback = useCallback(() => {
    availabilityNotice.runAvailabilityCheck();
    setAvailabilityConflictPrompt(true);
  }, [availabilityNotice]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      setLoadingEmployees(true);
      setError(null);
      const result = await fetchAreaCalendarBulkShiftContext(dialog.date, {
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
      });
      if (cancelled) return;
      if (!result.ok) {
        setError(translateActionError(result.error, t));
        setEmployees([]);
        setProfileShiftPreferences({});
      } else {
        setEmployees(result.employees);
        setProfileShiftPreferences(result.profileShiftPreferences);
        setTimeZone(result.timeZone);
      }
      setLoadingEmployees(false);
    }

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [dialog.date, relaxAppRegistrationGate, simulatedProposedOnAssign, t]);

  useEffect(() => {
    setEmployeeManuallySelected(false);
  }, [startTime, endTime]);

  useEffect(() => {
    if (skipShiftTypeFromTimesSyncRef.current) {
      skipShiftTypeFromTimesSyncRef.current = false;
      return;
    }
    if (!timesComplete) {
      setShiftTypeId((current) => (current ? "" : current));
      return;
    }
    const matchedPresetId =
      resolvePresetIdFromTimes(startTime, endTime, assignmentPresets) ?? "";
    setShiftTypeId((current) =>
      current === matchedPresetId ? current : matchedPresetId
    );
  }, [startTime, endTime, assignmentPresets, timesComplete]);

  useEffect(() => {
    if (employeeManuallySelected || loadingEmployees) return;

    if (!timesComplete) {
      setEmployeeId(EMPTY_EMPLOYEE_ID);
      return;
    }

    const { employee: preferred } = pickEmployeeForBulkPrefill(
      matchingEmployees,
      {
        weekday,
        demandStart: startTime,
        demandEnd: endTime,
        areaId: dialog.areaId ?? "",
        locationId,
        qualificationId: null,
      },
      profileShiftPreferences
    );
    setEmployeeId(preferred?.id ?? EMPTY_EMPLOYEE_ID);
  }, [
    matchingEmployees,
    timesComplete,
    loadingEmployees,
    employeeManuallySelected,
    startTime,
    endTime,
    weekday,
    dialog.areaId,
    locationId,
    profileShiftPreferences,
  ]);

  const handleEmployeeChange = useCallback(
    (nextId: string) => {
      setEmployeeManuallySelected(true);
      setEmployeeId(nextId);
      availabilityNotice.notifyEmployeeChange(nextId);
    },
    [availabilityNotice]
  );

  const handleShiftTypeChange = useCallback(
    (nextId: string) => {
      setShiftTypeId(nextId);
      const preset = assignmentPresets.find((item) => item.id === nextId);
      if (preset) {
        skipShiftTypeFromTimesSyncRef.current = true;
        const nextStart = timeFieldValue(preset.start_time);
        const nextEnd = timeFieldValue(preset.end_time);
        setStartTime(nextStart);
        setEndTime(nextEnd);
        availabilityNotice.notifyShiftTemplateChange(nextStart, nextEnd);
      }
    },
    [assignmentPresets, availabilityNotice]
  );

  const handleApplyAvailability = useCallback(
    (entry: AreaCalendarEmployeeAvailabilityEntry) => {
      const nextStart = timeFieldValue(entry.start_time);
      const nextEnd = timeFieldValue(entry.end_time);
      availabilityNotice.beforeTimeInputChange();
      skipShiftTypeFromTimesSyncRef.current = true;
      setStartTime(nextStart);
      setEndTime(nextEnd);
      setEmployeeManuallySelected(true);

      const matchedPresetId = resolvePresetIdFromTimes(
        nextStart,
        nextEnd,
        assignmentPresets
      );
      if (matchedPresetId) {
        setShiftTypeId(matchedPresetId);
      }
    },
    [assignmentPresets, availabilityNotice]
  );

  const performAssign = useCallback(
    async (options?: { withoutServiceHours?: boolean }) => {
      setSaving(true);
      setError(null);
      const result = await assignShiftWithTimes({
        employeeId,
        shiftDate: dialog.date,
        startTime,
        endTime,
        areaShiftTemplateId: simplePlanning
          ? null
          : areaShiftTemplateIdForAssign(shiftTypeId),
        locationId,
        locationAreaId: simplePlanning ? null : dialog.areaId,
        withoutServiceHours: options?.withoutServiceHours,
        assignToRemainingWeekDays: assignRestOfWeekDays,
        weekDates,
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
      });
      setSaving(false);

      if (!result.ok) {
        if (isShiftAssignAvailabilityConflictError(result.error)) {
          showAvailabilityConflictFeedback();
        }
        const translated = translateActionError(result.error, t);
        if (isShiftAssignWeeklyHoursExceededError(result.error)) {
          setWeeklyHoursAlertMessage(translated);
          setError(null);
          setComplianceNotice(null);
          return;
        }
        setWeeklyHoursAlertMessage(null);
        setError(translated);
        setComplianceNotice(null);
        return;
      }

      setWeeklyHoursAlertMessage(null);
      setError(null);
      onSaved?.();
      router.refresh();

      if (result.warnings?.length) {
        setComplianceNotice(result.warnings.join(" "));
        return;
      }

      onClose();
    },
    [
      employeeId,
      dialog.date,
      dialog.areaId,
      startTime,
      endTime,
      shiftTypeId,
      locationId,
      simplePlanning,
      onClose,
      onSaved,
      router,
      t,
      simulatedProposedOnAssign,
      relaxAppRegistrationGate,
      assignRestOfWeekDays,
      weekDates,
      showAvailabilityConflictFeedback,
    ]
  );

  const handleOk = useCallback(async () => {
    if (
      !employeeId ||
      employeeId === EMPTY_EMPLOYEE_ID ||
      !timesComplete
    ) {
      const message =
        employeeId && employeeId !== EMPTY_EMPLOYEE_ID && !timesComplete
          ? t("areaCalendar.bulkShiftValidationTimesRequired")
          : timesComplete &&
              (!employeeId || employeeId === EMPTY_EMPLOYEE_ID)
            ? t("areaCalendar.bulkShiftValidationEmployeeRequired")
            : t("areaCalendar.bulkShiftValidationEmployeeOrTimesRequired");
      setError(message);
      return;
    }

    if (
      evaluateShiftAssignAvailabilityConflict({
        employeeId,
        emptyEmployeeId: EMPTY_EMPLOYEE_ID,
        employees,
        weekday,
        startTime,
        endTime,
      })
    ) {
      showAvailabilityConflictFeedback();
      return;
    }

    if (!simplePlanning) {
      const serviceHoursCheck = validateAreaCalendarShiftServiceHours(
        serviceHours,
        dialog.areaId ?? "",
        dialog.date,
        startTime,
        endTime
      );
      if (!serviceHoursCheck.ok) {
        setOutsideServiceHoursConfirm(true);
        return;
      }
    }

    await performAssign();
  }, [
    employeeId,
    timesComplete,
    dialog.date,
    dialog.areaId,
    startTime,
    endTime,
    serviceHours,
    simplePlanning,
    performAssign,
    t,
    employees,
    weekday,
    showAvailabilityConflictFeedback,
  ]);

  const wishFulfilled = useMemo(() => {
    if (!employeeId || employeeId === EMPTY_EMPLOYEE_ID || !timesComplete) {
      return true;
    }
    return isEmployeeWishFulfilled(
      employeeId,
      {
        weekday,
        demandStart: startTime,
        demandEnd: endTime,
        areaId: dialog.areaId ?? "",
        locationId,
        qualificationId: null,
      },
      profileShiftPreferences
    );
  }, [
    employeeId,
    timesComplete,
    weekday,
    startTime,
    endTime,
    dialog.areaId,
    locationId,
    profileShiftPreferences,
  ]);

  const selectedEmployee = useMemo(
    () =>
      employeeId === EMPTY_EMPLOYEE_ID
        ? null
        : employees.find((employee) => employee.id === employeeId) ?? null,
    [employeeId, employees]
  );

  const selectedDayAvailabilities = useMemo(() => {
    if (!selectedEmployee) return [];
    return selectedEmployee.availabilities.filter(
      (slot) => slot.weekday === weekday
    );
  }, [selectedEmployee, weekday]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving &&
          !outsideServiceHoursConfirm &&
          !availabilityConflictPrompt &&
          !weeklyHoursAlertMessage
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="areacalendar-add-shift-title"
        className={cn(
          "relative z-[111] flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          ADD_SHIFT_MODAL_MAX_WIDTH_CLASS,
          MODAL_SCROLLBAR_CLASS
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 id="areacalendar-add-shift-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("areaCalendar.addShiftTitle")}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {simplePlanning
                ? `${dayHeader.weekday}, ${dayHeader.label}`
                : `${areaName} · ${dayHeader.weekday}, ${dayHeader.label}`}
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

        <div className="space-y-4 px-5 py-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {complianceNotice ? (
            <Alert variant="info">{complianceNotice}</Alert>
          ) : null}
          {!simplePlanning && assignmentPresets.length === 0 ? (
            <Alert variant="info">{t("areaCalendar.noShiftTemplatesForArea")}</Alert>
          ) : null}

          {!simplePlanning ? (
            <div>
              <LabelMuted>{presetLabel}</LabelMuted>
              <AreaCalendarShiftTypeCombobox
                value={shiftTypeId}
                presets={assignmentPresets}
                placeholder={presetPlaceholder}
                disabled={assignmentPresets.length === 0 || saving}
                onChange={handleShiftTypeChange}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelMuted>{t("shiftTypes.timeFrom")}</LabelMuted>
              <TimeInput
                className="mt-1"
                value={startTime}
                disabled={saving}
                onChange={(event) => {
                  availabilityNotice.beforeTimeInputChange();
                  setStartTime(event.target.value);
                }}
              />
            </div>
            <div>
              <LabelMuted>{t("shiftTypes.timeTo")}</LabelMuted>
              <TimeInput
                className="mt-1"
                value={endTime}
                disabled={saving}
                onChange={(event) => {
                  availabilityNotice.beforeTimeInputChange();
                  setEndTime(event.target.value);
                }}
              />
            </div>
          </div>

          <div>
            <LabelMuted>{t("common.basic")}</LabelMuted>
            <AreaCalendarShiftEmployeeCombobox
              value={employeeId}
              onChange={handleEmployeeChange}
              employees={matchingEmployees}
              selectedEmployee={selectedEmployee}
              weekday={weekday}
              dayAvailabilities={selectedDayAvailabilities}
              emptyLabel={t("areaCalendar.noEmployeeSelected")}
              disabled={loadingEmployees || saving}
              onApplyAvailability={handleApplyAvailability}
              weekdayLabelStyle="long"
            />
            {!wishFulfilled ? (
              <p className="mt-1 text-xs text-muted">
                {t("profiles.shiftPreferenceWishNotFulfilled")}
              </p>
            ) : null}
            {availabilityNotice.visible ? (
              <p className={ADD_SHIFT_AVAILABILITY_NOTICE_CLASS}>
                {t("areaCalendar.shiftOutsideEmployeeAvailability")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          {showAssignRestOfWeekDaysOption ? (
            <label className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-foreground">
              <Checkbox
                checked={assignRestOfWeekDays}
                disabled={saving}
                onChange={(event) =>
                  setAssignRestOfWeekDays(event.target.checked)
                }
                className="mt-0.5 shrink-0"
              />
              <span>{t("areaCalendar.assignRestOfWeekDays")}</span>
            </label>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleOk()} disabled={saving}>
              {t("common.ok")}
            </Button>
          </div>
        </div>
      </div>

      {outsideServiceHoursConfirm ? (
        <div
          className={areaCalendarNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setOutsideServiceHoursConfirm(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="areacalendar-add-shift-service-hours-confirm"
            className={areaCalendarAlertDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p
              id="areacalendar-add-shift-service-hours-confirm"
              className="text-sm text-foreground"
            >
              {t("areaCalendar.bulkShiftOutsideServiceHoursConfirm")}
            </p>
            <div
              className={settingsModalFooterClass(
                "mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end"
              )}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => setOutsideServiceHoursConfirm(false)}
                disabled={saving}
              >
                {t("common.no")}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => {
                  setOutsideServiceHoursConfirm(false);
                  void performAssign({ withoutServiceHours: true });
                }}
              >
                {t("common.yes")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {availabilityConflictPrompt ? (
        <div
          className={areaCalendarNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setAvailabilityConflictPrompt(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="areacalendar-add-shift-availability-conflict"
            className={areaCalendarAlertDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p
              id="areacalendar-add-shift-availability-conflict"
              className="text-sm text-red-600"
            >
              {t("areaCalendar.shiftOutsideEmployeeAvailability")}
            </p>
            <div
              className={settingsModalFooterClass(
                "mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end"
              )}
            >
              <Button
                type="button"
                variant="primary"
                onClick={() => setAvailabilityConflictPrompt(false)}
                disabled={saving}
              >
                {t("common.ok")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {weeklyHoursAlertMessage ? (
        <div
          className={areaCalendarNestedModalOverlayClass()}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="areacalendar-add-shift-weekly-hours-alert"
            className={areaCalendarAlertDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p
              id="areacalendar-add-shift-weekly-hours-alert"
              className="text-sm text-red-600"
            >
              {weeklyHoursAlertMessage}
            </p>
            <div
              className={settingsModalFooterClass(
                "mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end"
              )}
            >
              <Button
                type="button"
                variant="primary"
                onClick={() => setWeeklyHoursAlertMessage(null)}
                disabled={saving}
              >
                {t("common.ok")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
