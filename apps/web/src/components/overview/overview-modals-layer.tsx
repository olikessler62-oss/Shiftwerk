"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OverviewAbsencesModalHost } from "@/components/overview/overview-absences-modal-host";
import { OverviewAvailabilitiesModalHost } from "@/components/overview/overview-availabilities-modal-host";
import {
  closeOverviewModal,
  readOverviewAvailabilitiesEmployeeId,
  type OverviewModalQueryFlag,
} from "@/lib/overview-modal-navigation";
import { useClearMainNavPendingOptional } from "@/lib/app-shell-main-nav-pending";

export function OverviewModalsLayer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clearMainNavPending = useClearMainNavPendingOptional();

  const showAbsences = searchParams.get("uebersichtAbwesenheiten") === "1";
  const showAvailabilities = searchParams.get("uebersichtVerfuegbarkeiten") === "1";
  const initialAvailabilitiesEmployeeId =
    readOverviewAvailabilitiesEmployeeId(searchParams);

  const onClose = (flag: OverviewModalQueryFlag) => {
    closeOverviewModal(router, pathname, searchParams, flag);
  };

  useEffect(() => {
    if (showAbsences || showAvailabilities) {
      clearMainNavPending();
    }
  }, [showAbsences, showAvailabilities, clearMainNavPending]);

  if (showAbsences) {
    return (
      <OverviewAbsencesModalHost onClose={() => onClose("uebersichtAbwesenheiten")} />
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

  return null;
}
