"use client";

import { OverviewQualificationsEditableModal } from "./overview-qualifications-editable-modal";

type Props = {
  onClose: () => void;
  initialEmployeeId?: string | null;
};

export function OverviewQualificationsModalHost({ onClose, initialEmployeeId }: Props) {
  return (
    <OverviewQualificationsEditableModal
      onClose={onClose}
      initialEmployeeId={initialEmployeeId}
    />
  );
}
