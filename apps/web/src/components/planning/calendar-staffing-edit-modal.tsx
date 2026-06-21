"use client";

import { LocationStaffingDetailPanelModal } from "@/components/settings/location-staffing-detail-panel-modal";
import type { CalendarStaffingEditorData } from "@/lib/calendar-staffing-editor-data";
import type {
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaStaffingOverride,
} from "@schichtwerk/types";

type StaffingEditMode = "temporary" | "permanent";

type Props = {
  mode: StaffingEditMode;
  location: Location;
  area: LocationArea;
  anchorDate: string;
  weekDates: string[];
  shiftTemplates: AreaShiftTemplateWithBreaks[];
  editorData: CalendarStaffingEditorData;
  staffingOverrides: LocationAreaStaffingOverride[];
  initialServiceHourId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function CalendarStaffingEditModal({
  mode,
  location,
  area,
  anchorDate,
  weekDates,
  shiftTemplates,
  editorData,
  staffingOverrides,
  initialServiceHourId,
  onClose,
  onSaved,
}: Props) {
  return (
    <LocationStaffingDetailPanelModal
      overlayPlacement="fixed"
      mode={mode === "permanent" ? "bulk-edit" : "week-temporary"}
      location={location}
      area={area}
      serviceHours={editorData.serviceHours}
      shiftTemplates={shiftTemplates}
      qualifications={editorData.qualifications}
      staffing={editorData.staffing}
      initialServiceHourId={initialServiceHourId}
      calendarWeekDates={weekDates}
      anchorDate={anchorDate}
      staffingOverrides={staffingOverrides}
      onClose={onClose}
      onSaved={() => onSaved()}
    />
  );
}
