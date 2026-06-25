import { useState } from "react";
import type {
  AreaCalendarAddShiftDialogState,
  AreaCalendarBulkShiftDialogState,
} from "@/components/areacalendar/areacalendar-add-shift-modal";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";

/**
 * Manages open/close state for all dashboard modals and dialogs.
 * Extracted from DashboardView to separate UI dialog state from business logic.
 */
export function useDashboardDialogState() {
  const [addShiftDialog, setAddShiftDialog] =
    useState<AreaCalendarAddShiftDialogState | null>(null);
  const [bulkShiftDialog, setBulkShiftDialog] =
    useState<AreaCalendarBulkShiftDialogState | null>(null);
  const [shiftDeleteConfirmId, setShiftDeleteConfirmId] = useState<string | null>(null);
  const [deleteShiftError, setDeleteShiftError] = useState<string | null>(null);
  const [shiftCancelConfirm, setShiftCancelConfirm] = useState<{
    shiftId: string;
    employeeName: string;
  } | null>(null);
  const [cancelShiftError, setCancelShiftError] = useState<string | null>(null);
  const [confirmationSendError, setConfirmationSendError] = useState<string | null>(null);
  const [confirmShiftError, setConfirmShiftError] = useState<string | null>(null);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [communicationBusy, setCommunicationBusy] = useState(false);
  const [communicationOptions, setCommunicationOptions] = useState<
    CommunicationOpenOptions | undefined
  >(undefined);

  const openCommunication = (options?: CommunicationOpenOptions) => {
    setCommunicationOptions(options);
    setCommunicationBusy(false);
    setCommunicationOpen(true);
  };

  const closeCommunication = () => {
    setCommunicationOpen(false);
    setCommunicationBusy(false);
    setCommunicationOptions(undefined);
  };

  const isAnyModalOpen =
    Boolean(addShiftDialog) ||
    Boolean(bulkShiftDialog) ||
    Boolean(shiftDeleteConfirmId) ||
    Boolean(shiftCancelConfirm) ||
    communicationOpen;

  return {
    addShiftDialog,
    setAddShiftDialog,
    bulkShiftDialog,
    setBulkShiftDialog,
    shiftDeleteConfirmId,
    setShiftDeleteConfirmId,
    deleteShiftError,
    setDeleteShiftError,
    shiftCancelConfirm,
    setShiftCancelConfirm,
    cancelShiftError,
    setCancelShiftError,
    confirmationSendError,
    setConfirmationSendError,
    confirmShiftError,
    setConfirmShiftError,
    communicationOpen,
    setCommunicationOpen,
    communicationBusy,
    setCommunicationBusy,
    communicationOptions,
    openCommunication,
    closeCommunication,
    isAnyModalOpen,
  };
}
