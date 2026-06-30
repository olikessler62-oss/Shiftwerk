"use client";



import { useEffect } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { OverviewAbsencesModalHost } from "@/components/overview/overview-absences-modal-host";

import { OverviewAvailabilitiesModalHost } from "@/components/overview/overview-availabilities-modal-host";

import { OverviewCompensationModalHost } from "@/components/overview/overview-compensation-modal-host";

import { OverviewShiftPreferencesModalHost } from "@/components/overview/overview-shift-preferences-modal-host";

import { OverviewQualificationsModalHost } from "@/components/overview/overview-qualifications-modal-host";

import { OverviewSurchargesModalHost } from "@/components/overview/overview-surcharges-modal-host";

import {

  closeOverviewModal,

  readOverviewAbsencesEmployeeId,

  readOverviewAvailabilitiesEmployeeId,

  readOverviewCompensationEmployeeId,

  readOverviewShiftPreferencesEmployeeId,

  readOverviewQualificationsEmployeeId,

  readOverviewSurchargesEmployeeId,

  type OverviewModalQueryFlag,

} from "@/lib/overview-modal-navigation";

import { useClearMainNavPendingOptional } from "@/lib/app-shell-main-nav-pending";
import { useShowCompensationInPlanningUi } from "@/lib/org-features-provider";



export function OverviewModalsLayer() {

  const router = useRouter();

  const pathname = usePathname();

  const searchParams = useSearchParams();

  const clearMainNavPending = useClearMainNavPendingOptional();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();



  const showAbsences = searchParams.get("uebersichtAbwesenheiten") === "1";

  const showAvailabilities = searchParams.get("uebersichtVerfuegbarkeiten") === "1";

  const showPreferences = searchParams.get("uebersichtWuensche") === "1";

  const showCompensation = searchParams.get("uebersichtEntgelt") === "1";

  const showSurcharges = searchParams.get("uebersichtZuschlaege") === "1";

  const showQualifications = searchParams.get("uebersichtTaetigkeiten") === "1";

  const initialAvailabilitiesEmployeeId =

    readOverviewAvailabilitiesEmployeeId(searchParams);

  const initialAbsencesEmployeeId = readOverviewAbsencesEmployeeId(searchParams);

  const initialPreferencesEmployeeId =

    readOverviewShiftPreferencesEmployeeId(searchParams);

  const initialCompensationEmployeeId = readOverviewCompensationEmployeeId(searchParams);

  const initialSurchargesEmployeeId = readOverviewSurchargesEmployeeId(searchParams);

  const initialQualificationsEmployeeId =
    readOverviewQualificationsEmployeeId(searchParams);



  const onClose = (flag: OverviewModalQueryFlag) => {

    closeOverviewModal(router, pathname, searchParams, flag);

  };



  useEffect(() => {
    if (!showCompensationInPlanningUi) {
      if (showCompensation) {
        closeOverviewModal(router, pathname, searchParams, "uebersichtEntgelt");
      }
      if (showSurcharges) {
        closeOverviewModal(router, pathname, searchParams, "uebersichtZuschlaege");
      }
    }
  }, [
    pathname,
    router,
    searchParams,
    showCompensation,
    showCompensationInPlanningUi,
    showSurcharges,
  ]);

  useEffect(() => {

    if (

      showAbsences ||

      showAvailabilities ||

      showPreferences ||

      showCompensation ||

      showSurcharges ||

      showQualifications

    ) {

      clearMainNavPending();

    }

  }, [

    showAbsences,

    showAvailabilities,

    showPreferences,

    showCompensation,

    showSurcharges,

    showQualifications,

    clearMainNavPending,

  ]);



  if (showAbsences) {

    return (

      <OverviewAbsencesModalHost

        onClose={() => onClose("uebersichtAbwesenheiten")}

        initialEmployeeId={initialAbsencesEmployeeId}

      />

    );

  }



  if (showAvailabilities) {

    return (

      <OverviewAvailabilitiesModalHost

        onClose={() => onClose("uebersichtVerfuegbarkeiten")}

        initialEmployeeId={initialAvailabilitiesEmployeeId}

      />

    );

  }



  if (showPreferences) {

    return (

      <OverviewShiftPreferencesModalHost

        onClose={() => onClose("uebersichtWuensche")}

        initialEmployeeId={initialPreferencesEmployeeId}

      />

    );

  }



  if (showCompensation) {

    if (!showCompensationInPlanningUi) return null;

    return (

      <OverviewCompensationModalHost

        onClose={() => onClose("uebersichtEntgelt")}

        initialEmployeeId={initialCompensationEmployeeId}

      />

    );

  }



  if (showSurcharges) {

    if (!showCompensationInPlanningUi) return null;

    return (

      <OverviewSurchargesModalHost

        onClose={() => onClose("uebersichtZuschlaege")}

        initialEmployeeId={initialSurchargesEmployeeId}

      />

    );

  }



  if (showQualifications) {

    return (

      <OverviewQualificationsModalHost

        onClose={() => onClose("uebersichtTaetigkeiten")}

        initialEmployeeId={initialQualificationsEmployeeId}

      />

    );

  }



  return null;

}

