import { describe, expect, it } from "vitest";
import { isEmployeeVisibleConfirmationStatus } from "./employee-shift-visibility";

describe("isEmployeeVisibleConfirmationStatus", () => {
  it("hides proposed shifts from employees", () => {
    expect(isEmployeeVisibleConfirmationStatus("proposed")).toBe(false);
  });

  it("shows shifts after confirmation request or without open planning state", () => {
    expect(isEmployeeVisibleConfirmationStatus("requested")).toBe(true);
    expect(isEmployeeVisibleConfirmationStatus("pending")).toBe(true);
    expect(isEmployeeVisibleConfirmationStatus("confirmed")).toBe(true);
    expect(isEmployeeVisibleConfirmationStatus("rejected")).toBe(true);
    expect(isEmployeeVisibleConfirmationStatus("canceled")).toBe(true);
    expect(isEmployeeVisibleConfirmationStatus("unresolved")).toBe(true);
  });
});
