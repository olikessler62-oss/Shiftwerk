"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type {
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaServiceHour,
  Profile,
  Qualification,
  CompensationSurchargeType,
  Role,
  AreaShiftTemplateWithBreaks,
} from "@schichtwerk/types";
import type {
  AreaServiceHourRef,
  StaffingRule,
} from "@/lib/location-staffing-client";
import { QualificationsModal } from "@/components/settings/qualifications-modal";
import { CompensationSurchargeTypesModal } from "@/components/settings/compensation-surcharge-types-modal";
import { LocationsModal } from "@/components/settings/locations-modal";
import { RolesModal } from "@/components/settings/roles-modal";
import { AbsencesModal } from "@/components/settings/absences-modal";
import { ProfilesModal } from "@/components/settings/profiles-modal";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";
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
  fullStaffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  shifts: DashboardShiftCard[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  compensationSurchargeTypes: CompensationSurchargeType[];
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
  fullStaffingRules,
  serviceHours,
  shifts,
  areaShiftTemplates,
  qualifications,
  compensationSurchargeTypes,
  roles,
  profiles,
  locations,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showLocations = searchParams.get("standorte") === "1";
  const showProfiles = searchParams.get("profiles") === "1";
  const showRoles = searchParams.get("rollen") === "1";
  const showQualifications = searchParams.get("qualifikationen") === "1";
  const showSurcharges =
    COMPENSATION_SURCHARGES_UI_ENABLED &&
    searchParams.get("sonderzuschlaege") === "1";
  const showAbsences = searchParams.get("abwesenheiten") === "1";

  function closeSettingsModal(
    flag:
      | "standorte"
      | "profiles"
      | "rollen"
      | "qualifikationen"
      | "sonderzuschlaege"
      | "abwesenheiten"
  ) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(flag);
    const q = params.toString();
    router.push(q ? `/dashboard?${q}` : "/dashboard");
  }

  return (
    <div
      className="-mx-4 -mt-4 -mb-4 flex h-[calc(100%+32px)] min-h-0 flex-col bg-background pb-[10px] md:-mx-6 md:-mt-6 md:-mb-6 md:h-[calc(100%+48px)]"
      onContextMenu={(event) => event.preventDefault()}
    >
      <DashboardHeader
        weekStart={weekStart}
        locations={locations}
        selectedLocationId={selectedLocationId}
      />
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2 md:px-4 md:pt-4">
        <DashboardCalendar
          dates={dates}
          locationId={selectedLocationId}
          locationName={selectedLocation?.name ?? ""}
          areas={areas}
          staffingRules={staffingRules}
          serviceHours={serviceHours}
          shifts={shifts}
          areaShiftTemplates={areaShiftTemplates}
          qualifications={qualifications}
          profiles={profiles}
          fullStaffingRules={fullStaffingRules}
        />
        {showLocations && (
          <LocationsModal
            locations={locations}
            initialSelectedLocationId={selectedLocationId}
            initialAreas={areas}
            initialSelectedAreaId={areas[0]?.id ?? null}
            initialServiceHours={serviceHours as LocationAreaServiceHour[]}
            initialStaffing={fullStaffingRules}
            initialShiftTemplates={areaShiftTemplates}
            onClose={() => closeSettingsModal("standorte")}
          />
        )}
        {showProfiles && (
          <ProfilesModal
            profiles={profiles}
            onClose={() => closeSettingsModal("profiles")}
          />
        )}
        {showRoles && (
          <RolesModal
            roles={roles}
            onClose={() => closeSettingsModal("rollen")}
          />
        )}
        {showQualifications && (
          <QualificationsModal
            qualifications={qualifications}
            onClose={() => closeSettingsModal("qualifikationen")}
          />
        )}
        {showSurcharges && (
          <CompensationSurchargeTypesModal
            surchargeTypes={compensationSurchargeTypes}
            onClose={() => closeSettingsModal("sonderzuschlaege")}
          />
        )}
        {showAbsences && (
          <AbsencesModal
            profiles={profiles}
            onClose={() => closeSettingsModal("abwesenheiten")}
          />
        )}
      </section>
    </div>
  );
}
