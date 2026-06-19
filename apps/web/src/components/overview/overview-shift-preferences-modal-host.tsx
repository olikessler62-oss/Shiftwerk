"use client";

import { OverviewShiftPreferencesEditableModal } from "./overview-shift-preferences-editable-modal";

type Props = {
  onClose: () => void;
  initialEmployeeId?: string | null;
};

export function OverviewShiftPreferencesModalHost({ onClose, initialEmployeeId }: Props) {
  return (
    <OverviewShiftPreferencesEditableModal
      onClose={onClose}
      initialEmployeeId={initialEmployeeId}
    />
  );
}
