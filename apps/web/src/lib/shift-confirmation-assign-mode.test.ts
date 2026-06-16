import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveShiftConfirmationEnabledForAssign,
  resolveSimulatedProposedAssignOptions,
} from "./shift-confirmation-assign-mode";

describe("resolveShiftConfirmationEnabledForAssign", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses organization flag when enabled", () => {
    expect(
      resolveShiftConfirmationEnabledForAssign({
        organizationEnabled: true,
        simulatedProposedOnAssign: false,
        managerEmail: "dev@example.com",
      })
    ).toBe(true);
  });

  it("allows simulated assign only for superadmin emails", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", "dev@example.com");
    vi.resetModules();

    return import("./shift-confirmation-assign-mode").then(
      ({ resolveShiftConfirmationEnabledForAssign }) => {
        expect(
          resolveShiftConfirmationEnabledForAssign({
            organizationEnabled: false,
            simulatedProposedOnAssign: true,
            managerEmail: "dev@example.com",
          })
        ).toBe(true);
        expect(
          resolveShiftConfirmationEnabledForAssign({
            organizationEnabled: false,
            simulatedProposedOnAssign: true,
            managerEmail: "other@example.com",
          })
        ).toBe(false);
      }
    );
  });
});

describe("resolveSimulatedProposedAssignOptions", () => {
  it("relaxes app registration gate only in simulation mode", () => {
    vi.stubEnv("SUPERADMIN_EMAILS", "dev@example.com");
    vi.resetModules();

    return import("./shift-confirmation-assign-mode").then(
      ({ resolveSimulatedProposedAssignOptions }) => {
        expect(
          resolveSimulatedProposedAssignOptions({
            organizationEnabled: false,
            simulatedProposedOnAssign: true,
            managerEmail: "dev@example.com",
          })
        ).toEqual({
          shiftConfirmationEnabled: true,
          relaxAppRegistrationGate: true,
        });
        expect(
          resolveSimulatedProposedAssignOptions({
            organizationEnabled: true,
            simulatedProposedOnAssign: true,
            managerEmail: "dev@example.com",
          })
        ).toEqual({
          shiftConfirmationEnabled: true,
          relaxAppRegistrationGate: false,
        });
      }
    );
  });
});
