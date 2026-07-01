export type SuperadminTestScenarioShiftCoverageMode = "open" | "covered" | "mixed";

export type SuperadminTestScenarioShiftsPerDayMode = "one" | "two" | "three";

export type TestScenarioShiftWindow = {
  start: string;
  end: string;
};

export type TestScenarioShiftDefinition = TestScenarioShiftWindow & {
  name: string;
};

export type SuperadminTestScenarioSeedSettings = {
  shiftCoverageMode: SuperadminTestScenarioShiftCoverageMode;
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode;
  shifts: TestScenarioShiftDefinition[];
};

export type TestScenarioShiftTemplate = TestScenarioShiftDefinition & {
  color: string;
  breaks?: readonly { break_start: string; break_end: string }[];
};

export type TestScenarioShiftSchedule = {
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode;
  serviceWindows: readonly TestScenarioShiftWindow[];
  shiftTemplates: readonly TestScenarioShiftTemplate[];
};

const ONE_SHIFT_SCHEDULE = {
  serviceWindows: [{ start: "08:00", end: "17:00" }],
  shiftTemplates: [
    { name: "Normal", start: "08:00", end: "17:00", color: "#3b82f6" },
  ],
} as const satisfies Pick<TestScenarioShiftSchedule, "serviceWindows" | "shiftTemplates">;

const TWO_SHIFT_SCHEDULE = {
  serviceWindows: [
    { start: "08:00", end: "17:00" },
    { start: "12:00", end: "20:00" },
  ],
  shiftTemplates: [
    {
      name: "Früh",
      start: "08:00",
      end: "17:00",
      color: "#3b82f6",
      breaks: [{ break_start: "13:00", break_end: "14:00" }],
    },
    {
      name: "Spät",
      start: "12:00",
      end: "20:00",
      color: "#f97316",
      breaks: [{ break_start: "15:30", break_end: "16:30" }],
    },
  ],
} as const satisfies Pick<TestScenarioShiftSchedule, "serviceWindows" | "shiftTemplates">;

const THREE_SHIFT_SCHEDULE = {
  serviceWindows: [
    { start: "07:00", end: "10:00" },
    { start: "12:00", end: "15:00" },
    { start: "18:00", end: "22:00" },
  ],
  shiftTemplates: [
    { name: "Früh", start: "07:00", end: "10:00", color: "#3b82f6" },
    { name: "Normal", start: "12:00", end: "15:00", color: "#22c55e" },
    { name: "Spät", start: "18:00", end: "22:00", color: "#f97316" },
  ],
} as const satisfies Pick<TestScenarioShiftSchedule, "serviceWindows" | "shiftTemplates">;

const PRESET_SHIFT_NAMES = new Set(["Normal", "Früh", "Spät", "Tag", "Mittel"]);

const PRESET_SHIFT_WINDOWS = new Set(
  [ONE_SHIFT_SCHEDULE, TWO_SHIFT_SCHEDULE, THREE_SHIFT_SCHEDULE].flatMap((schedule) =>
    schedule.shiftTemplates.map((template) => `${template.start}|${template.end}`)
  )
);

function isPresetShiftWindow(start: string, end: string): boolean {
  return PRESET_SHIFT_WINDOWS.has(`${start}|${end}`);
}

function resolveShiftDefinition(
  existing: TestScenarioShiftDefinition | undefined,
  fallback: TestScenarioShiftDefinition
): TestScenarioShiftDefinition {
  if (!existing) return { ...fallback };
  const existingName = existing.name.trim();
  const useFallbackName =
    !existingName ||
    (PRESET_SHIFT_NAMES.has(existingName) && existingName !== fallback.name);
  const existingStart = existing.start.trim();
  const existingEnd = existing.end.trim();
  const useFallbackTimes =
    !existingStart ||
    !existingEnd ||
    (isPresetShiftWindow(existingStart, existingEnd) &&
      (existingStart !== fallback.start || existingEnd !== fallback.end));
  return {
    name: useFallbackName ? fallback.name : existingName,
    start: useFallbackTimes ? fallback.start : existingStart,
    end: useFallbackTimes ? fallback.end : existingEnd,
  };
}

function baseScheduleForMode(
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode
): Pick<TestScenarioShiftSchedule, "serviceWindows" | "shiftTemplates"> {
  if (shiftsPerDayMode === "one") return ONE_SHIFT_SCHEDULE;
  if (shiftsPerDayMode === "two") return TWO_SHIFT_SCHEDULE;
  return THREE_SHIFT_SCHEDULE;
}

export function shiftCountForMode(
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode
): number {
  if (shiftsPerDayMode === "one") return 1;
  if (shiftsPerDayMode === "two") return 2;
  return 3;
}

export const SUPERADMIN_TEST_SCENARIO_SHIFTS_PER_DAY_MULTIPLIER = 20;

/** Ziel-Schichtanzahl pro Kalenderwoche (Besetzung „nur besetzt“). */
export function targetShiftCountForMode(
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode
): number {
  return shiftCountForMode(shiftsPerDayMode) * SUPERADMIN_TEST_SCENARIO_SHIFTS_PER_DAY_MULTIPLIER;
}

/** Personal-Bedarf pro Schichtfenster und Bereich für die Wochen-Zielschichtanzahl. */
export function staffingCountPerWindowForScenario(input: {
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode;
  openDaysPerWeek: number;
  areaCount?: number;
}): number {
  const areaCount = input.areaCount ?? 1;
  const windowCount = shiftCountForMode(input.shiftsPerDayMode);
  const target = targetShiftCountForMode(input.shiftsPerDayMode);
  const slots = input.openDaysPerWeek * windowCount * areaCount;
  return Math.max(1, Math.round(target / slots));
}

export function defaultShiftsForMode(
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode
): TestScenarioShiftDefinition[] {
  return baseScheduleForMode(shiftsPerDayMode).shiftTemplates.map((template) => ({
    name: template.name,
    start: template.start,
    end: template.end,
  }));
}

export function createDefaultSuperadminTestScenarioSeedSettings(): SuperadminTestScenarioSeedSettings {
  const shiftsPerDayMode = "two";
  return {
    shiftCoverageMode: "mixed",
    shiftsPerDayMode,
    shifts: defaultShiftsForMode(shiftsPerDayMode),
  };
}

export function shiftsForModeChange(
  current: readonly TestScenarioShiftDefinition[],
  newMode: SuperadminTestScenarioShiftsPerDayMode
): TestScenarioShiftDefinition[] {
  const defaults = defaultShiftsForMode(newMode);
  return defaults.map((fallback, index) =>
    resolveShiftDefinition(current[index], fallback)
  );
}

function resolveShifts(
  shifts: readonly TestScenarioShiftDefinition[],
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode
): TestScenarioShiftDefinition[] {
  const defaults = defaultShiftsForMode(shiftsPerDayMode);
  return defaults.map((fallback, index) =>
    resolveShiftDefinition(shifts[index], fallback)
  );
}

export function resolvedShiftsForSettings(
  settings: Pick<SuperadminTestScenarioSeedSettings, "shiftsPerDayMode" | "shifts">
): TestScenarioShiftDefinition[] {
  return resolveShifts(settings.shifts, settings.shiftsPerDayMode);
}

export function buildSuperadminTestScenarioShiftSchedule(
  settings: Pick<SuperadminTestScenarioSeedSettings, "shiftsPerDayMode" | "shifts">
): TestScenarioShiftSchedule {
  const { shiftsPerDayMode } = settings;
  const base = baseScheduleForMode(shiftsPerDayMode);
  const resolvedShifts = resolveShifts(settings.shifts, shiftsPerDayMode);
  const serviceWindows = resolvedShifts.map(({ start, end }) => ({ start, end }));

  return {
    shiftsPerDayMode,
    serviceWindows,
    shiftTemplates: base.shiftTemplates.map((template, index) => {
      const shift = resolvedShifts[index]!;
      return {
        ...template,
        name: shift.name,
        start: shift.start,
        end: shift.end,
      };
    }),
  };
}

export function coverageTargetForMixedMode(
  requiredCount: number,
  seed: number
): number {
  const bucket = seed % 10;
  if (bucket < 3) return 0;
  if (bucket < 6) {
    return requiredCount <= 1 ? 0 : Math.max(1, requiredCount - 1);
  }
  return requiredCount;
}
