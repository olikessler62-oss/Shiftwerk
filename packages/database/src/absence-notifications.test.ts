import { describe, expect, it } from "vitest";
import {
  absenceTypeLabelDe,
  buildEmployeeAbsenceReviewNotification,
  buildManagerAbsenceSubmittedNotification,
  formatAbsenceEndLabel,
} from "./absence-notifications";

describe("absenceTypeLabelDe", () => {
  it("maps known types", () => {
    expect(absenceTypeLabelDe("sick")).toBe("Krank");
    expect(absenceTypeLabelDe("vacation")).toBe("Urlaub");
    expect(absenceTypeLabelDe("other")).toBe("Sonstiges");
  });
});

describe("formatAbsenceEndLabel", () => {
  it("returns Offen for open-ended", () => {
    expect(formatAbsenceEndLabel({ isOpenEnded: true, endDate: null })).toBe("Offen");
  });
});

describe("buildManagerAbsenceSubmittedNotification", () => {
  it("builds notification for open sick leave", () => {
    const notification = buildManagerAbsenceSubmittedNotification({
      employeeName: "Anna Müller",
      employeeId: "emp-1",
      absenceId: "abs-1",
      type: "sick",
      startDate: "2026-06-05",
      endDate: null,
      isOpenEnded: true,
      status: "approved",
    });

    expect(notification.type).toBe("absence_submitted");
    expect(notification.title).toBe("Krank: Anna Müller");
    expect(notification.body).toContain("krank gemeldet");
    expect(notification.body).toContain("Offen");
    expect(notification.payload.absence_id).toBe("abs-1");
  });

  it("marks pending vacation", () => {
    const notification = buildManagerAbsenceSubmittedNotification({
      employeeName: "Ben",
      employeeId: "emp-2",
      absenceId: "abs-2",
      type: "vacation",
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      isOpenEnded: false,
      status: "pending",
    });

    expect(notification.body).toContain("(Ausstehend)");
    expect(notification.payload.type).toBe("vacation");
  });
});

describe("buildEmployeeAbsenceReviewNotification", () => {
  it("builds approved notification", () => {
    const notification = buildEmployeeAbsenceReviewNotification({
      absenceId: "abs-1",
      type: "vacation",
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      isOpenEnded: false,
      approved: true,
    });

    expect(notification.templateKey).toBe("absence.approved");
    expect(notification.title).toBe("Urlaub genehmigt");
    expect(notification.body).toContain("genehmigt");
    expect(notification.payload.status).toBe("approved");
  });

  it("builds rejected notification for open sick leave", () => {
    const notification = buildEmployeeAbsenceReviewNotification({
      absenceId: "abs-2",
      type: "sick",
      startDate: "2026-06-05",
      endDate: null,
      isOpenEnded: true,
      approved: false,
    });

    expect(notification.templateKey).toBe("absence.rejected");
    expect(notification.title).toBe("Krank abgelehnt");
    expect(notification.body).toContain("Offen");
  });
});
