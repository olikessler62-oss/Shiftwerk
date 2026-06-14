import { describe, expect, it } from "vitest";
import {
  validateHourlyRateEdit,
  validateHourlyRateValidFromPolicy,
  validateNewHourlyRate,
} from "@schichtwerk/database";

describe("validateNewHourlyRate", () => {
  it("allows a new valid_from date", () => {
    expect(
      validateNewHourlyRate({
        valid_from: "2026-07-01",
        existingValidFromDates: ["2026-01-01"],
      }).ok
    ).toBe(true);
  });

  it("rejects duplicate valid_from dates", () => {
    expect(
      validateNewHourlyRate({
        valid_from: "2026-01-01",
        existingValidFromDates: ["2026-01-01"],
      }).ok
    ).toBe(false);
  });
});

describe("validateHourlyRateValidFromPolicy", () => {
  it("allows future dates regardless of policy", () => {
    expect(
      validateHourlyRateValidFromPolicy({
        valid_from: "2026-12-01",
        serverToday: "2026-06-05",
        allowRetroactive: false,
      }).ok
    ).toBe(true);
  });

  it("blocks past dates when retroactive entries are disabled", () => {
    expect(
      validateHourlyRateValidFromPolicy({
        valid_from: "2026-01-01",
        serverToday: "2026-06-05",
        allowRetroactive: false,
      }).ok
    ).toBe(false);
  });

  it("allows keeping an unchanged past date on edit", () => {
    expect(
      validateHourlyRateValidFromPolicy({
        valid_from: "2026-01-01",
        serverToday: "2026-06-05",
        allowRetroactive: false,
        initialValidFrom: "2026-01-01",
      }).ok
    ).toBe(true);
  });
});

describe("validateHourlyRateEdit", () => {
  it("keeps valid_from between predecessor and successor", () => {
    expect(
      validateHourlyRateEdit({
        valid_from: "2026-04-01",
        existingValidFromDates: ["2026-01-01", "2026-07-01"],
        predecessorValidFrom: "2026-01-01",
        successorValidFrom: "2026-07-01",
      }).ok
    ).toBe(true);

    expect(
      validateHourlyRateEdit({
        valid_from: "2026-08-01",
        existingValidFromDates: ["2026-01-01"],
        predecessorValidFrom: "2026-01-01",
        successorValidFrom: "2026-08-01",
      }).ok
    ).toBe(false);
  });
});
