import { describe, expect, it } from "vitest";
import {
  formatEnglishWeekdayAbbrev,
  formatGermanWeekdayAbbrev,
  weekdayAbbrevFromIndex,
  weekdayAbbrevFromTranslatedName,
} from "./weekday-labels";

describe("formatEnglishWeekdayAbbrev", () => {
  it("normalizes full names case-insensitively", () => {
    expect(formatEnglishWeekdayAbbrev("monday")).toBe("Mon");
    expect(formatEnglishWeekdayAbbrev("TUESDAY")).toBe("Tue");
    expect(formatEnglishWeekdayAbbrev("WeDnEsDay")).toBe("Wed");
  });

  it("normalizes short forms and trailing dots", () => {
    expect(formatEnglishWeekdayAbbrev("Thu.")).toBe("Thu");
    expect(formatEnglishWeekdayAbbrev("fri")).toBe("Fri");
    expect(formatEnglishWeekdayAbbrev("SAT")).toBe("Sat");
  });

  it("returns three-letter title case abbreviations", () => {
    expect(formatEnglishWeekdayAbbrev("Sunday")).toBe("Sun");
    expect(formatEnglishWeekdayAbbrev("thursday")).toBe("Thu");
  });
});

describe("formatGermanWeekdayAbbrev", () => {
  it("normalizes full names case-insensitively", () => {
    expect(formatGermanWeekdayAbbrev("montag")).toBe("Mo.");
    expect(formatGermanWeekdayAbbrev("DIENSTAG")).toBe("Di.");
    expect(formatGermanWeekdayAbbrev("MiTtWoCh")).toBe("Mi.");
  });

  it("normalizes short forms and trailing dots", () => {
    expect(formatGermanWeekdayAbbrev("Do.")).toBe("Do.");
    expect(formatGermanWeekdayAbbrev("fr")).toBe("Fr.");
    expect(formatGermanWeekdayAbbrev("SO")).toBe("So.");
  });

  it("returns two letters with trailing dot", () => {
    expect(formatGermanWeekdayAbbrev("Sonntag")).toBe("So.");
    expect(formatGermanWeekdayAbbrev("Samstag")).toBe("Sa.");
    expect(formatGermanWeekdayAbbrev("Sonnabend")).toBe("Sa.");
  });
});

describe("weekdayAbbrevFromIndex", () => {
  it("returns English three-letter abbrevs", () => {
    expect(weekdayAbbrevFromIndex(0, "en")).toBe("Mon");
    expect(weekdayAbbrevFromIndex(6, "en")).toBe("Sun");
  });

  it("returns German two-letter abbrevs with dot", () => {
    expect(weekdayAbbrevFromIndex(0, "de")).toBe("Mo.");
    expect(weekdayAbbrevFromIndex(6, "de")).toBe("So.");
  });
});

describe("weekdayAbbrevFromTranslatedName", () => {
  it("uses English formatter for en locale", () => {
    expect(weekdayAbbrevFromTranslatedName("Wednesday", "en")).toBe("Wed");
  });

  it("uses German formatter for de locale", () => {
    expect(weekdayAbbrevFromTranslatedName("Mittwoch", "de")).toBe("Mi.");
    expect(weekdayAbbrevFromTranslatedName("freitag", "de")).toBe("Fr.");
  });
});
