import type { Profile } from "@schichtwerk/types";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";

export type CsvImportRow = {
  employeeId: string;
  areaShiftTemplateId: string | null;
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

function resolveShiftTemplate(
  token: string,
  presets: readonly DashboardAssignmentPreset[]
): string | null {
  const needle = token.trim().toLowerCase();
  if (!needle) return null;
  return presets.find((preset) => preset.name.trim().toLowerCase() === needle)?.id ?? null;
}

export function parseBulkShiftCsv(
  csvText: string,
  profiles: readonly Profile[],
  presets: readonly DashboardAssignmentPreset[]
): CsvImportParseOutcome {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV enthält keine Datenzeilen."] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  const employeeIdx = header.findIndex((h) =>
    ["mitarbeiter", "employee", "name"].includes(h)
  );
  const typeIdx = header.findIndex((h) =>
    ["schicht", "schichtvorlage", "template", "type"].includes(h)
  );
  const fromIdx = header.findIndex((h) => ["von", "from", "start"].includes(h));
  const toIdx = header.findIndex((h) => ["bis", "to", "end"].includes(h));

  if (employeeIdx < 0 || fromIdx < 0 || toIdx < 0) {
    return {
      rows: [],
      errors: ["Erforderliche Spalten: Mitarbeiter, Von, Bis."],
    };
  }

  const rows: CsvImportRow[] = [];
  const errors: string[] = [];

  for (let lineNo = 1; lineNo < lines.length; lineNo++) {
    const cells = parseCsvLine(lines[lineNo], delimiter);
    const employeeToken = cells[employeeIdx] ?? "";
    const employee = resolveEmployee(employeeToken, profiles);
    if (!employee) {
      errors.push(`Zeile ${lineNo + 1}: Mitarbeiter „${employeeToken}“ nicht gefunden.`);
      continue;
    }

    const startTime = normalizeTime(cells[fromIdx] ?? "");
    const endTime = normalizeTime(cells[toIdx] ?? "");
    if (!startTime || !endTime) {
      errors.push(`Zeile ${lineNo + 1}: Ungültige Von-/Bis-Zeit.`);
      continue;
    }

    let areaShiftTemplateId: string | null = null;
    if (typeIdx >= 0) {
      const typeToken = cells[typeIdx] ?? "";
      areaShiftTemplateId = resolveShiftTemplate(typeToken, presets);
      if (typeToken.trim() && !areaShiftTemplateId) {
        errors.push(`Zeile ${lineNo + 1}: Schichtvorlage „${typeToken}“ nicht gefunden.`);
        continue;
      }
    }

    rows.push({
      employeeId: employee.id,
      areaShiftTemplateId,
      startTime,
      endTime,
    });
  }

  return { rows, errors };
}
