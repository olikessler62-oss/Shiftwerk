"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type {
  Location,
  LocationArea,
  Profile,
  Qualification,
  Role,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";
import type {
  AreaServiceHourRef,
  StaffingRule,
} from "@/lib/location-staffing-client";
import { ShiftTypesModal } from "@/components/settings/shift-types-modal";
import { QualificationsModal } from "@/components/settings/qualifications-modal";
import { LocationsModal } from "@/components/settings/locations-modal";
import { RolesModal } from "@/components/settings/roles-modal";
import { ProfilesModal } from "@/components/settings/profiles-modal";
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
  serviceHours: AreaServiceHourRef[];
  shifts: DashboardShiftCard[];
  shiftTypes: ShiftTypeWithBreaks[];
  qualifications: Qualification[];
  roles: Role[];
  profiles: Profile[];
  locations: Location[];
};

export function DashboardView({
  weekStart,
  dates,
  selectedLocationId,
  selectedLocation,
  areas,
  staffingRules,
  serviceHours,
  shifts,
  shiftTypes,
  qualifications,
  roles,
  profiles,
  locations,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showLocations = searchParams.get("standorte") === "1";
  const showProfiles = searchParams.get("profiles") === "1";
  const showRoles = searchParams.get("rollen") === "1";
  const showShiftTypes = searchParams.get("schichtarten") === "1";
  const showQualifications = searchParams.get("qualifikationen") === "1";

  function closeSettingsModal(
    flag:
      | "standorte"
      | "profiles"
      | "rollen"
      | "schichtarten"
      | "qualifikationen"
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
          areas={areas}
          staffingRules={staffingRules}
          serviceHours={serviceHours}
          shifts={shifts}
        />
        {showLocations && (
          <LocationsModal
            locations={locations}
            initialSelectedLocationId={selectedLocationId}
            initialAreas={areas}
            initialSelectedAreaId={areas[0]?.id ?? null}
            onClose={() => closeSettingsModal("standorte")}
          />
        )}
        {showProfiles && (
          <ProfilesModal
            profiles={profiles}
            shiftTypes={shiftTypes}
            onClose={() => closeSettingsModal("profiles")}
          />
        )}
        {showRoles && (
          <RolesModal
            roles={roles}
            onClose={() => closeSettingsModal("rollen")}
          />
        )}
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
      </section>
    </div>
  );
}
