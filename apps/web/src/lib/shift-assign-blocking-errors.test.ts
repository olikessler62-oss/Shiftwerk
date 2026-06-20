import { describe, expect, it } from "vitest";
import {
  isShiftAssignWeeklyHoursExceededError,
  shiftAssignAlertPromptForError,
} from "./shift-assign-blocking-errors";

describe("shift-assign-blocking-errors", () => {
  it("detects weekly hours exceeded messages", () => {
    expect(
      isShiftAssignWeeklyHoursExceededError(
        "Anna: Wochenstunden überschritten — nach Zuweisung 48 Std. (Maximum 40 Std.)."
      )
    ).toBe(true);
    expect(
      isShiftAssignWeeklyHoursExceededError(
        "Anna: Weekly hours exceeded — after assignment 48 h (maximum 40 h)."
      )
    ).toBe(true);
    expect(isShiftAssignWeeklyHoursExceededError("Speichern fehlgeschlagen")).toBe(
      false
    );
  });

  it("marks weekly hours alerts as blocking", () => {
    const prompt = shiftAssignAlertPromptForError(
      "Wochenstunden überschritten — nach Zuweisung 48 Std. (Maximum 40 Std.).",
      (message) => message
    );
    expect(prompt.blocking).toBe(true);
  });
});
