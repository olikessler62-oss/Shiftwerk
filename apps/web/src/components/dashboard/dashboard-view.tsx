"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type {
  Location,
  LocationArea,
  Qualification,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";
import type { StaffingRule } from "@/lib/location-staffing-client";
import { ShiftTypesModal } from "@/components/settings/shift-types-modal";
import { QualificationsModal } from "@/components/settings/qualifications-modal";
import { LocationsModal } from "@/components/settings/locations-modal";
import { DashboardHeader } from "./dashboard-header";
import {
  DashboardCalendar,
  type DashboardShiftCard,
} from "./dashboard-calendar";

type Props = {
  weekStart: string;
  dates: string[];
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  areas: LocationArea[];
  staffingRules: StaffingRule[];
  shifts: DashboardShiftCard[];
  shiftTypes: ShiftTypeWithBreaks[];
  qualifications: Qualification[];
  locations: Location[];
};

export function DashboardView({
  weekStart,
  dates,
  selectedLocationId,
  selectedLocation,
  areas,
  staffingRules,
  shifts,
  shiftTypes,
  qualifications,
  locations,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showShiftTypes = searchParams.get("schichtarten") === "1";
  const showQualifications = searchParams.get("qualifikationen") === "1";
  const showLocations = searchParams.get("standorte") === "1";

  function closeSettingsModal(
    flag: "schichtarten" | "qualifikationen" | "standorte"
  ) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(flag);
    const q = params.toString();
    router.push(q ? `/dashboard?${q}` : "/dashboard");
  }

  return (
    <div className="-m-6 flex min-h-screen flex-col bg-background">
      <DashboardHeader weekStart={weekStart} />
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <DashboardCalendar
          dates={dates}
          locations={locations}
          selectedLocationId={selectedLocationId}
          selectedLocation={selectedLocation}
          areas={areas}
          staffingRules={staffingRules}
          shifts={shifts}
        />
        {showShiftTypes && (
          <ShiftTypesModal
            shiftTypes={shiftTypes}
            onClose={() => closeSettingsModal("schichtarten")}
          />
        )}
        {showQualifications && (
          <QualificationsModal
            qualifications={qualifications}
            onClose={() => closeSettingsModal("qualifikationen")}
          />
        )}
        {showLocations && (
          <LocationsModal
            locations={locations}
            initialSelectedLocationId={selectedLocationId}
            initialAreas={areas}
            initialSelectedAreaId={areas[0]?.id ?? null}
            onClose={() => closeSettingsModal("standorte")}
          />
        )}
      </section>
    </div>
  );
}
