"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useOrganization } from "@/lib/org-features-provider";
import {
  readShiftConfirmationRelaxAppGatePreference,
  writeShiftConfirmationRelaxAppGatePreference,
} from "@/lib/shift-confirmation-relax-app-gate-preference";
import {
  readShiftConfirmationSimulationAssignPreference,
  writeShiftConfirmationSimulationAssignPreference,
} from "@/lib/shift-confirmation-simulation-assign-preference";
import {
  readShiftConfirmationSimulationPreference,
  writeShiftConfirmationSimulationPreference,
} from "@/lib/shift-confirmation-simulation-preference";

type ShiftConfirmationSimulationContextValue = {
  /** Simulierter UI-Zustand (unabhängig vom Org-Flag in der DB). */
  shiftConfirmationEnabled: boolean;
  setShiftConfirmationEnabled: (enabled: boolean) => void;
  /** Neue Zuweisungen als proposed speichern (nur Simulation, Superadmin). */
  simulatedProposedOnAssign: boolean;
  setSimulatedProposedOnAssign: (enabled: boolean) => void;
  /** App-Registrierungs-Gate bei Zuweisung umgehen (Superadmin, Session). */
  relaxAppRegistrationGate: boolean;
  setRelaxAppRegistrationGate: (enabled: boolean) => void;
  /** Temporärer Schalter: niemals echte Benachrichtigungen auslösen. */
  blocksOutboundSend: boolean;
};

const ShiftConfirmationSimulationContext =
  createContext<ShiftConfirmationSimulationContextValue | null>(null);

export function ShiftConfirmationSimulationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const organization = useOrganization();
  const orgDefault = organization.shift_confirmation_enabled;
  const [shiftConfirmationEnabled, setShiftConfirmationState] = useState(orgDefault);
  const [simulatedProposedOnAssign, setSimulatedProposedState] = useState(false);
  const [relaxAppRegistrationGate, setRelaxAppRegistrationGateState] = useState(false);

  useEffect(() => {
    setShiftConfirmationState(readShiftConfirmationSimulationPreference(orgDefault));
    setSimulatedProposedState(readShiftConfirmationSimulationAssignPreference(false));
    setRelaxAppRegistrationGateState(readShiftConfirmationRelaxAppGatePreference(false));
  }, [orgDefault]);

  const value = useMemo(
    (): ShiftConfirmationSimulationContextValue => ({
      shiftConfirmationEnabled,
      setShiftConfirmationEnabled: (enabled: boolean) => {
        writeShiftConfirmationSimulationPreference(enabled);
        setShiftConfirmationState(enabled);
        if (!enabled) {
          writeShiftConfirmationSimulationAssignPreference(false);
          setSimulatedProposedState(false);
        }
      },
      simulatedProposedOnAssign,
      setSimulatedProposedOnAssign: (enabled: boolean) => {
        writeShiftConfirmationSimulationAssignPreference(enabled);
        setSimulatedProposedState(enabled);
      },
      relaxAppRegistrationGate,
      setRelaxAppRegistrationGate: (enabled: boolean) => {
        writeShiftConfirmationRelaxAppGatePreference(enabled);
        setRelaxAppRegistrationGateState(enabled);
      },
      blocksOutboundSend: true,
    }),
    [relaxAppRegistrationGate, shiftConfirmationEnabled, simulatedProposedOnAssign]
  );

  return (
    <ShiftConfirmationSimulationContext.Provider value={value}>
      {children}
    </ShiftConfirmationSimulationContext.Provider>
  );
}

export function useShiftConfirmationSimulation(): ShiftConfirmationSimulationContextValue {
  const context = useContext(ShiftConfirmationSimulationContext);
  if (!context) {
    throw new Error(
      "useShiftConfirmationSimulation must be used within ShiftConfirmationSimulationProvider"
    );
  }
  return context;
}

export function useEffectiveShiftConfirmationEnabled(): boolean {
  return useShiftConfirmationSimulation().shiftConfirmationEnabled;
}

/** Für Server Actions: Simulations-Flags aus dem Superadmin-Panel. */
export function useSimulatedProposedOnAssignRequest(): {
  simulatedProposedOnAssign: boolean;
  relaxAppRegistrationGate: boolean;
} {
  const {
    shiftConfirmationEnabled,
    simulatedProposedOnAssign,
    relaxAppRegistrationGate,
  } = useShiftConfirmationSimulation();

  return {
    simulatedProposedOnAssign:
      shiftConfirmationEnabled && simulatedProposedOnAssign,
    relaxAppRegistrationGate,
  };
}
