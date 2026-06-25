import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeShift } from "@/app/actions/shifts";
import { cancelShiftAsManager, confirmPastShiftAsManager } from "@/app/actions/shift-confirmations";
import { translateActionError } from "@/lib/translate-action-error";
import { translatePastConfirmError, translateShiftCancelError } from "@/lib/shift-cancellation-policy";
import { useTranslations } from "@/i18n/locale-provider";

interface UseShiftActionsParams {
  onDeleteSuccess: () => void;
  onCancelSuccess: () => void;
  onConfirmSuccess: () => void;
  onDeleteError: (message: string) => void;
  onCancelError: (message: string) => void;
  onConfirmError: (message: string) => void;
}

export function useShiftActions({
  onDeleteSuccess,
  onCancelSuccess,
  onConfirmSuccess,
  onDeleteError,
  onCancelError,
  onConfirmError,
}: UseShiftActionsParams) {
  const router = useRouter();
  const t = useTranslations();
  const [deleteShiftPending, startDeleteShift] = useTransition();
  const [cancelShiftPending, startCancelShift] = useTransition();
  const [confirmShiftPending, startConfirmShift] = useTransition();

  const deleteShift = useCallback(
    (shiftId: string) => {
      startDeleteShift(async () => {
        const result = await removeShift(shiftId);
        if (!result.ok) {
          onDeleteError(translateActionError(result.error, t));
          return;
        }
        onDeleteSuccess();
        router.refresh();
      });
    },
    [router, t, onDeleteSuccess, onDeleteError]
  );

  const cancelShift = useCallback(
    (shiftId: string) => {
      startCancelShift(async () => {
        const result = await cancelShiftAsManager(shiftId);
        if (!result.ok) {
          onCancelError(translateShiftCancelError(result.error, t));
          return;
        }
        onCancelSuccess();
        router.refresh();
      });
    },
    [router, t, onCancelSuccess, onCancelError]
  );

  const confirmShift = useCallback(
    (shiftId: string) => {
      startConfirmShift(async () => {
        const result = await confirmPastShiftAsManager(shiftId);
        if (!result.ok) {
          onConfirmError(translatePastConfirmError(result.error, t));
          return;
        }
        onConfirmSuccess();
        router.refresh();
      });
    },
    [router, t, onConfirmSuccess, onConfirmError]
  );

  return {
    deleteShift,
    cancelShift,
    confirmShift,
    deleteShiftPending,
    cancelShiftPending,
    confirmShiftPending,
  };
}
