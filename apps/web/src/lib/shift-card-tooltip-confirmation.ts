import { hasPendingEmployeeCancellation } from "@schichtwerk/database";
import type { ShiftCardDisplayState } from "@schichtwerk/types";
import type { ShiftCardTooltipData } from "@/lib/shift-card-display-content";

export function applyPendingEmployeeCancellationToShiftTooltip(
  tooltip: ShiftCardTooltipData,
  displayState: ShiftCardDisplayState | undefined,
  cancellationPendingLabel: string,
  employeeCancellationReason?: string | null
): ShiftCardTooltipData {
  if (!hasPendingEmployeeCancellation(displayState)) {
    return tooltip;
  }

  const reason =
    employeeCancellationReason?.trim() ||
    displayState?.openCancellation?.reason?.trim() ||
    undefined;

  return {
    ...tooltip,
    confirmationStatusLine: cancellationPendingLabel,
    confirmationStatus: "confirmed",
    employeeCancellationPending: true,
    ...(reason ? { employeeCancellationReason: reason } : {}),
  };
}
