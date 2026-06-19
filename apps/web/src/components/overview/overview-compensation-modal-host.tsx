"use client";

import { OverviewCompensationEditableModal } from "./overview-compensation-editable-modal";

type Props = {
  onClose: () => void;
  initialEmployeeId?: string | null;
};

export function OverviewCompensationModalHost({ onClose, initialEmployeeId }: Props) {
  return (
    <OverviewCompensationEditableModal
      onClose={onClose}
      initialEmployeeId={initialEmployeeId}
    />
  );
}
