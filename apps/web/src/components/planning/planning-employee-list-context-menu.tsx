"use client";

import type { RefObject } from "react";
import { useTranslations } from "@/i18n/locale-provider";
import type { PlanningEmployeeListContextMenuState } from "@/lib/use-planning-employee-list-context-menu";

type Props = {
  state: PlanningEmployeeListContextMenuState;
  menuRef: RefObject<HTMLDivElement | null>;
  onOpenAvailabilities: (employeeId: string) => void;
};

export function PlanningEmployeeListContextMenu({
  state,
  menuRef,
  onOpenAvailabilities,
}: Props) {
  const t = useTranslations();

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[15rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
      style={{ left: state.x, top: state.y }}
      role="menu"
      aria-label={t("profiles.panelAvailability")}
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
    </div>
  );
}
