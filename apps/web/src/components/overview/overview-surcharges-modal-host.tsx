"use client";

import { OverviewSurchargesEditableModal } from "./overview-surcharges-editable-modal";

type Props = {
  onClose: () => void;
  initialEmployeeId?: string | null;
};

export function OverviewSurchargesModalHost({ onClose, initialEmployeeId }: Props) {
  return (
    <OverviewSurchargesEditableModal
      onClose={onClose}
      initialEmployeeId={initialEmployeeId}
    />
  );
}
