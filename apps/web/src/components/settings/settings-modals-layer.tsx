"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AreaShiftTemplateWithBreaks,
  CompensationSurchargeType,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Profile,
  Qualification,
  Role,
} from "@schichtwerk/types";
import { QualificationsModal } from "@/components/settings/qualifications-modal";
import { CompensationSurchargeTypesModal } from "@/components/settings/compensation-surcharge-types-modal";
import { LocationsModal } from "@/components/settings/locations-modal";
import { RolesModal } from "@/components/settings/roles-modal";
import { AbsencesModal } from "@/components/settings/absences-modal";
import { OrganizationCompensationSettingsModal } from "@/components/settings/organization-compensation-settings-modal";
import { ProfilesModal } from "@/components/settings/profiles-modal";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";
import { useOrgFeatures } from "@/lib/org-features-provider";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import {
  closeSettingsModal,
  type SettingsModalQueryFlag,
} from "@/lib/settings-modal-navigation";
import { useClearMainNavPendingOptional } from "@/lib/app-shell-main-nav-pending";

export type SettingsModalsLayerData = {
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  serviceHours: AreaServiceHourRef[] | LocationAreaServiceHour[];
  fullStaffingRules: LocationAreaStaffing[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  compensationSurchargeTypes: CompensationSurchargeType[];
  roles: Role[];
  profiles: Profile[];
};

type Props = {
  data: SettingsModalsLayerData;
};

export function SettingsModalsLayer({ data }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const features = useOrgFeatures();

  const onClose = (flag: SettingsModalQueryFlag) => {
    closeSettingsModal(router, pathname, searchParams, flag);
  };

  const showLocations =
    features.areas && searchParams.get("standorte") === "1";
  const showProfiles = searchParams.get("profiles") === "1";
  const showRoles = searchParams.get("rollen") === "1";
  const showQualifications =
    features.qualifications && searchParams.get("qualifikationen") === "1";
  const showSurcharges =
    features.qualifications &&
    COMPENSATION_SURCHARGES_UI_ENABLED &&
    searchParams.get("sonderzuschlaege") === "1";
  const showAbsences = searchParams.get("abwesenheiten") === "1";
  const showCompensationSettings = searchParams.get("arbeitsentgelt") === "1";

  const clearMainNavPending = useClearMainNavPendingOptional();
  const anyModalOpen =
    showLocations ||
    showProfiles ||
    showRoles ||
    showQualifications ||
    showSurcharges ||
    showAbsences ||
    showCompensationSettings;

  useEffect(() => {
    if (anyModalOpen) {
      clearMainNavPending();
    }
  }, [anyModalOpen, clearMainNavPending]);

  const initialAreaId =
    searchParams.get("area") ?? data.areas[0]?.id ?? null;

  return (
    <>
      {showLocations ? (
        <LocationsModal
          locations={data.locations}
          initialSelectedLocationId={data.selectedLocationId}
          initialAreas={data.areas}
          initialSelectedAreaId={initialAreaId}
          initialServiceHours={data.serviceHours as LocationAreaServiceHour[]}
          initialStaffing={data.fullStaffingRules}
          initialShiftTemplates={data.areaShiftTemplates}
          onClose={() => onClose("standorte")}
        />
      ) : null}
      {showProfiles ? (
        <ProfilesModal
          profiles={data.profiles}
          onClose={() => onClose("profiles")}
        />
      ) : null}
      {showRoles ? (
        <RolesModal
          roles={data.roles}
          onClose={() => onClose("rollen")}
        />
      ) : null}
      {showQualifications ? (
        <QualificationsModal
          qualifications={data.qualifications}
          onClose={() => onClose("qualifikationen")}
        />
      ) : null}
      {showSurcharges ? (
        <CompensationSurchargeTypesModal
          surchargeTypes={data.compensationSurchargeTypes}
          onClose={() => onClose("sonderzuschlaege")}
        />
      ) : null}
      {showAbsences ? (
        <AbsencesModal
          profiles={data.profiles}
          onClose={() => onClose("abwesenheiten")}
        />
      ) : null}
      {showCompensationSettings ? (
        <OrganizationCompensationSettingsModal
          onClose={() => onClose("arbeitsentgelt")}
        />
      ) : null}
    </>
  );
}
