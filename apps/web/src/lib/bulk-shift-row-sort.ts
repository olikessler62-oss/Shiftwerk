import type {
  BulkShiftSortColumn,
  BulkShiftSortDirection,
} from "@/lib/bulk-shift-column-prefs";

export type BulkShiftColumnSortRow = {
  id: string;
  shiftTypeId: string;
  shiftTypeName: string;
  qualificationId: string;
  qualificationName: string;
  startTime: string;
  endTime: string;
  employeeId: string;
  employeeName: string;
};

function isIncompleteTime(time: string): boolean {
  return !time || time === "00:00";
}

function compareEmptyLast(
  aEmpty: boolean,
  bEmpty: boolean,
  direction: BulkShiftSortDirection
): number | null {
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return direction === "asc" ? 1 : -1;
  if (bEmpty) return direction === "asc" ? -1 : 1;
  return null;
}

function splitEmployeeName(fullName: string): { surname: string; given: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { surname: "", given: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { surname: parts[0]!, given: "" };
  return {
    surname: parts[parts.length - 1]!,
    given: parts.slice(0, -1).join(" "),
  };
}

function compareEmployeeNames(a: string, b: string): number {
  const nameA = splitEmployeeName(a);
  const nameB = splitEmployeeName(b);
  const bySurname = nameA.surname.localeCompare(nameB.surname, "de");
  if (bySurname !== 0) return bySurname;
  return nameA.given.localeCompare(nameB.given, "de");
}

function compareByColumn(
  a: BulkShiftColumnSortRow,
  b: BulkShiftColumnSortRow,
  column: BulkShiftSortColumn,
  direction: BulkShiftSortDirection
): number {
  const sign = direction === "asc" ? 1 : -1;

  switch (column) {
    case "template": {
      const aEmpty = !a.shiftTypeId;
      const bEmpty = !b.shiftTypeId;
      const emptyCmp = compareEmptyLast(aEmpty, bEmpty, direction);
      if (emptyCmp !== null) return emptyCmp;
      return (
        sign *
        (a.shiftTypeName.localeCompare(b.shiftTypeName, "de") ||
          a.id.localeCompare(b.id))
      );
    }
    case "qualification": {
      const aEmpty = !a.qualificationId;
      const bEmpty = !b.qualificationId;
      const emptyCmp = compareEmptyLast(aEmpty, bEmpty, direction);
      if (emptyCmp !== null) return emptyCmp;
      return (
        sign *
        (a.qualificationName.localeCompare(b.qualificationName, "de") ||
          a.id.localeCompare(b.id))
      );
    }
    case "startTime": {
      const aEmpty = isIncompleteTime(a.startTime);
      const bEmpty = isIncompleteTime(b.startTime);
      const emptyCmp = compareEmptyLast(aEmpty, bEmpty, direction);
      if (emptyCmp !== null) return emptyCmp;
      return sign * (a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
    }
    case "endTime": {
      const aEmpty = isIncompleteTime(a.endTime);
      const bEmpty = isIncompleteTime(b.endTime);
      const emptyCmp = compareEmptyLast(aEmpty, bEmpty, direction);
      if (emptyCmp !== null) return emptyCmp;
      return sign * (a.endTime.localeCompare(b.endTime) || a.id.localeCompare(b.id));
    }
    case "employee": {
      const aEmpty = !a.employeeId;
      const bEmpty = !b.employeeId;
      const emptyCmp = compareEmptyLast(aEmpty, bEmpty, direction);
      if (emptyCmp !== null) return emptyCmp;
      return (
        sign *
        (compareEmployeeNames(a.employeeName, b.employeeName) ||
          a.id.localeCompare(b.id))
      );
    }
    default:
      return 0;
  }
}

export function sortBulkShiftRowsByColumn<T extends BulkShiftColumnSortRow>(
  rows: readonly T[],
  column: BulkShiftSortColumn | null,
  direction: BulkShiftSortDirection | null
): T[] {
  if (!column || !direction) return [...rows];
  return [...rows].sort((a, b) => compareByColumn(a, b, column, direction));
}
