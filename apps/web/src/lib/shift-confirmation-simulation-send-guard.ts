export const SHIFT_CONFIRMATION_SIMULATION_SEND_BLOCKED_MESSAGE =
  "Simulation: Es werden keine Push-Nachrichten oder E-Mails versendet.";

export function getShiftConfirmationSimulationSendBlockedResult(): {
  ok: false;
  error: string;
} {
  return {
    ok: false,
    error: SHIFT_CONFIRMATION_SIMULATION_SEND_BLOCKED_MESSAGE,
  };
}
