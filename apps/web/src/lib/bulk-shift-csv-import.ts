import type { Profile, ShiftTypeWithBreaks } from "@schichtwerk/types";

export type CsvImportRow = {
  employeeId: string;
  shiftTypeId: string | null;
  startTime: string;
  endTime: string;
};

export type CsvImportResult =
  | { ok: true; rows: CsvImportRow[] }
  | { ok: false; error: string };

export type CsvImportParseOutcome = {
  rows: CsvImportRow[];
  errors: string[];
};

function detectDelimiter(headerLine: string): "," | ";" {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: "," | ";"): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/^\uFEFF/, "");
}

function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const h = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function resolveEmployee(
  token: string,
  profiles: readonly Profile[]
): Profile | null {
  const needle = token.trim().toLowerCase();
  if (!needle) return null;
  return (
    profiles.find(
      (p) =>
        p.full_name.trim().toLowerCase() === needle ||
        (p.email?.trim().toLowerCase() ?? "") === needle
    ) ?? null
  );
}

function resolveShiftType(
  token: string,
  shiftTypes: readonly ShiftTypeWithBreaks[]
): string | null {
  const needle = token.trim().toLowerCase();
  if (!needle) return null;
  return shiftTypes.find((t) => t.name.trim().toLowerCase() === needle)?.id ?? null;
}

export function parseBulkShiftCsv(
  text: string,
  profiles: readonly Profile[],
  shiftTypes: readonly ShiftTypeWithBreaks[]
): CsvImportParseOutcome {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { rows: [], errors: ["CSV ist leer."] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  const employeeIdx = headers.indexOf("employee");
  const startIdx = headers.indexOf("start_time");
  const endIdx = headers.indexOf("end_time");
  const typeIdx = headers.indexOf("shift_type");

  if (employeeIdx < 0 || startIdx < 0 || endIdx < 0) {
    return {
      rows: [],
      errors: ["Header muss employee, start_time, end_time enthalten."],
    };
  }

  const rows: CsvImportRow[] = [];
  const errors: string[] = [];

  for (let lineNo = 1; lineNo < lines.length; lineNo++) {
    const cells = parseCsvLine(lines[lineNo], delimiter);
    const employeeToken = cells[employeeIdx] ?? "";
    const startRaw = cells[startIdx] ?? "";
    const endRaw = cells[endIdx] ?? "";
    const typeToken = typeIdx >= 0 ? (cells[typeIdx] ?? "") : "";

    const startTime = normalizeTime(startRaw);
    const endTime = normalizeTime(endRaw);
    const profile = resolveEmployee(employeeToken, profiles);

    if (!profile) {
      errors.push(`Zeile ${lineNo + 1}: Mitarbeiter „${employeeToken}“ unbekannt.`);
      continue;
    }
    if (!startTime || !endTime) {
      errors.push(`Zeile ${lineNo + 1}: Ungültige Uhrzeit.`);
      continue;
    }
    if (startTime === endTime) {
      errors.push(`Zeile ${lineNo + 1}: Von und Bis dürfen nicht gleich sein.`);
      continue;
    }

    let shiftTypeId: string | null = null;
    if (typeToken.trim()) {
      shiftTypeId = resolveShiftType(typeToken, shiftTypes);
      if (!shiftTypeId) {
        errors.push(`Zeile ${lineNo + 1}: Schichttyp „${typeToken}“ unbekannt.`);
        continue;
      }
    }

    rows.push({
      employeeId: profile.id,
      shiftTypeId,
      startTime,
      endTime,
    });
  }

  return { rows, errors };
}
