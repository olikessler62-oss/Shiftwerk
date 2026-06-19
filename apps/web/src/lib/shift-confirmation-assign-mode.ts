import { isSuperadminDeveloperEmail } from "@/lib/superadmin-access";

export function resolveShiftConfirmationEnabledForAssign(input: {
  organizationEnabled: boolean;
  simulatedProposedOnAssign?: boolean;
  managerEmail: string;
}): boolean {
  if (input.organizationEnabled) return true;
  return (
    input.simulatedProposedOnAssign === true &&
    isSuperadminDeveloperEmail(input.managerEmail)
  );
}

export function resolveSimulatedProposedAssignOptions(input: {
  organizationEnabled: boolean;
  simulatedProposedOnAssign?: boolean;
  relaxAppRegistrationGate?: boolean;
  managerEmail: string;
}): {
  shiftConfirmationEnabled: boolean;
  relaxAppRegistrationGate: boolean;
} {
  const shiftConfirmationEnabled = resolveShiftConfirmationEnabledForAssign(input);
  const isSuperadmin = isSuperadminDeveloperEmail(input.managerEmail);
  const relaxAppRegistrationGate =
    isSuperadmin &&
    (input.relaxAppRegistrationGate === true ||
      (shiftConfirmationEnabled &&
        !input.organizationEnabled &&
        input.simulatedProposedOnAssign === true));

  return { shiftConfirmationEnabled, relaxAppRegistrationGate };
}
