"use client";

import { OVERVIEW_ABSENCES_EDIT_ENABLED } from "@/lib/overview-absences-edit-feature";
import { OverviewAbsencesEditableModal } from "./overview-absences-editable-modal";
import { OverviewAbsencesModal } from "./overview-absences-modal";

type Props = {
  onClose: () => void;
};

export function OverviewAbsencesModalHost({ onClose }: Props) {
  if (OVERVIEW_ABSENCES_EDIT_ENABLED) {
    return <OverviewAbsencesEditableModal onClose={onClose} />;
  }
  return <OverviewAbsencesModal onClose={onClose} />;
}
