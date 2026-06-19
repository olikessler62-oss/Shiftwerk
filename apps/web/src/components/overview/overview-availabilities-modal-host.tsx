"use client";

import { OVERVIEW_AVAILABILITIES_EDIT_ENABLED } from "@/lib/overview-availabilities-edit-feature";
import { OverviewAvailabilitiesEditableModal } from "./overview-availabilities-editable-modal";
import { OverviewAvailabilitiesModal } from "./overview-availabilities-modal";

type Props = {
  onClose: () => void;
  initialEmployeeId?: string | null;
};

export function OverviewAvailabilitiesModalHost({ onClose, initialEmployeeId }: Props) {
  if (OVERVIEW_AVAILABILITIES_EDIT_ENABLED) {
    return (
      <OverviewAvailabilitiesEditableModal
        onClose={onClose}
        initialEmployeeId={initialEmployeeId}
      />
    );
  }
  return <OverviewAvailabilitiesModal onClose={onClose} />;
}
