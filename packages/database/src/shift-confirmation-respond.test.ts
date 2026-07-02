import { describe, expect, it } from "vitest";
import {
  assertRespondItemsAllowed,
  buildManagerResponseSummaryNotification,
  decisionToConfirmationStatus,
  isEmployeeRespondableConfirmationStatus,
  validateConfirmationRespondItems,
} from "./shift-confirmation-respond";

describe("isEmployeeRespondableConfirmationStatus", () => {
  it("accepts requested and pending only", () => {
    expect(isEmployeeRespondableConfirmationStatus("requested")).toBe(true);
    expect(isEmployeeRespondableConfirmationStatus("pending")).toBe(true);
    expect(isEmployeeRespondableConfirmationStatus("proposed")).toBe(false);
    expect(isEmployeeRespondableConfirmationStatus("confirmed")).toBe(false);
  });
});

describe("validateConfirmationRespondItems", () => {
  it("rejects empty payloads", () => {
    expect(validateConfirmationRespondItems([])).toEqual({
      ok: false,
      error: "Keine Antworten angegeben.",
    });
  });

  it("rejects duplicate shift ids", () => {
    expect(
      validateConfirmationRespondItems([
        { shiftId: "shift-1", decision: "confirm" },
        { shiftId: "shift-1", decision: "reject" },
      ])
    ).toEqual({
      ok: false,
      error: "Doppelte Schicht-ID im Request.",
    });
  });

  it("accepts optional rejection reason up to 200 characters", () => {
    expect(
      validateConfirmationRespondItems([
        { shiftId: "shift-1", decision: "reject", reason: "Passt zeitlich nicht" },
      ])
    ).toEqual({ ok: true });
  });

  it("rejects rejection reason on confirm items", () => {
    expect(
      validateConfirmationRespondItems([
        { shiftId: "shift-1", decision: "confirm", reason: "Nope" },
      ])
    ).toEqual({
      ok: false,
      error: "Grund nur bei Ablehnung erlaubt.",
    });
  });

  it("rejects overly long rejection reasons", () => {
    expect(
      validateConfirmationRespondItems([
        { shiftId: "shift-1", decision: "reject", reason: "a".repeat(201) },
      ])
    ).toEqual({
      ok: false,
      error: "Ablehnungsgrund ist zu lang (max. 200 Zeichen).",
    });
  });
});

describe("assertRespondItemsAllowed", () => {
  const openShifts = new Map([
    [
      "shift-1",
      {
        id: "shift-1",
        employee_id: "emp-1",
        confirmation_status: "requested" as const,
      },
    ],
  ]);

  it("rejects foreign shift ids", () => {
    expect(
      assertRespondItemsAllowed(
        [{ shiftId: "shift-2", decision: "confirm" }],
        openShifts,
        "emp-1"
      )
    ).toEqual({
      ok: false,
      error: "Schicht nicht gefunden oder nicht mehr offen.",
    });
  });

  it("rejects shifts owned by another employee", () => {
    expect(
      assertRespondItemsAllowed(
        [{ shiftId: "shift-1", decision: "confirm" }],
        openShifts,
        "emp-2"
      )
    ).toEqual({
      ok: false,
      error: "Schicht gehört nicht zum Mitarbeiter.",
    });
  });
});

describe("decisionToConfirmationStatus", () => {
  it("maps confirm and reject", () => {
    expect(decisionToConfirmationStatus("confirm")).toBe("confirmed");
    expect(decisionToConfirmationStatus("reject")).toBe("rejected");
  });
});

describe("buildManagerResponseSummaryNotification", () => {
  it("uses all-confirmed copy when every item is confirm", () => {
    const notification = buildManagerResponseSummaryNotification({
      employeeName: "Alex",
      decisions: ["confirm", "confirm"],
      shiftIds: ["s1", "s2"],
    });
    expect(notification.allConfirmed).toBe(true);
    expect(notification.body).toContain("vollständig bestätigt");
  });

  it("uses rejection copy when at least one item is reject", () => {
    const notification = buildManagerResponseSummaryNotification({
      employeeName: "Alex",
      decisions: ["confirm", "reject"],
      shiftIds: ["s1", "s2"],
    });
    expect(notification.allConfirmed).toBe(false);
    expect(notification.body).toContain("Ablehnungen");
  });
});
