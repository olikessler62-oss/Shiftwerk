"use client";



import type { RefObject } from "react";

import { useTranslations } from "@/i18n/locale-provider";
import { useClampedContextMenuPosition } from "@/lib/context-menu-position";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";
import { useOrgFeatures } from "@/lib/org-features-provider";

import type { PlanningEmployeeListContextMenuState } from "@/lib/use-planning-employee-list-context-menu";



type Props = {

  state: PlanningEmployeeListContextMenuState;

  menuRef: RefObject<HTMLDivElement | null>;

  onOpenAvailabilities: (employeeId: string) => void;

  onOpenAbsences: (employeeId: string) => void;

  onOpenPreferences: (employeeId: string) => void;

  onOpenCompensation: (employeeId: string) => void;

  onOpenSurcharges: (employeeId: string) => void;

  onOpenQualifications: (employeeId: string) => void;

};



export function PlanningEmployeeListContextMenu({

  state,

  menuRef,

  onOpenAvailabilities,

  onOpenAbsences,

  onOpenPreferences,

  onOpenCompensation,

  onOpenSurcharges,

  onOpenQualifications,

}: Props) {

  const t = useTranslations();

  const features = useOrgFeatures();

  const position = useClampedContextMenuPosition(
    true,
    state.x,
    state.y,
    menuRef,
    [features.qualifications, COMPENSATION_SURCHARGES_UI_ENABLED]
  );

  return (

    <div

      ref={menuRef}

      className="fixed z-[100] min-w-[15rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"

      style={{ left: position.x, top: position.y }}

      role="menu"

      aria-label={t("nav.overview")}

      onMouseDown={(event) => event.stopPropagation()}

    >

      <button

        type="button"

        role="menuitem"

        className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"

        onClick={() => onOpenAvailabilities(state.employeeId)}

      >

        {t("profiles.panelAvailability")}

      </button>

      <button

        type="button"

        role="menuitem"

        className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"

        onClick={() => onOpenAbsences(state.employeeId)}

      >

        {t("profiles.panelAbsences")}

      </button>

      <button

        type="button"

        role="menuitem"

        className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"

        onClick={() => onOpenPreferences(state.employeeId)}

      >

        {t("profiles.panelShiftPreferences")}

      </button>

      <button

        type="button"

        role="menuitem"

        className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"

        onClick={() => onOpenCompensation(state.employeeId)}

      >

        {t("profiles.panelCompensation")}

      </button>

      {COMPENSATION_SURCHARGES_UI_ENABLED ? (

        <button

          type="button"

          role="menuitem"

          className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"

          onClick={() => onOpenSurcharges(state.employeeId)}

        >

          {t("profiles.surchargesSection")}

        </button>

      ) : null}

      {features.qualifications ? (

        <button

          type="button"

          role="menuitem"

          className="w-full cursor-pointer px-3 py-1.5 text-left text-sm text-foreground hover:bg-subtle"

          onClick={() => onOpenQualifications(state.employeeId)}

        >

          {t("profiles.panelQualifications")}

        </button>

      ) : null}

    </div>

  );

}

