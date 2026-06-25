import type { Profile } from "@schichtwerk/types";
import { splitEmployeeDisplayName } from "@/lib/shift-card-display-content";

export function compareProfilesByFirstName(a: Profile, b: Profile): number {
  const aNames = splitEmployeeDisplayName(a.full_name);
  const bNames = splitEmployeeDisplayName(b.full_name);
  const byFirst = aNames.firstName.localeCompare(bNames.firstName, "de", {
    sensitivity: "base",
  });
  if (byFirst !== 0) return byFirst;
  const byLast = aNames.lastName.localeCompare(bNames.lastName, "de", {
    sensitivity: "base",
  });
  if (byLast !== 0) return byLast;
  return a.full_name.localeCompare(b.full_name, "de", { sensitivity: "base" });
}

export function sortProfilesByFirstName<T extends Profile>(profiles: readonly T[]): T[] {
  return [...profiles].sort(compareProfilesByFirstName);
}

/** Mitarbeiter-Kalender: zuerst mit Schichten, absteigend nach Anzahl; Rest nach Vorname. */
export function sortProfilesByShiftCountDesc<T extends Profile>(
  profiles: readonly T[],
  shifts: readonly { employee_id: string }[]
): T[] {
  const countByEmployeeId = new Map<string, number>();
  for (const shift of shifts) {
    countByEmployeeId.set(
      shift.employee_id,
      (countByEmployeeId.get(shift.employee_id) ?? 0) + 1
    );
  }

  return [...profiles].sort((a, b) => {
    const countDiff =
      (countByEmployeeId.get(b.id) ?? 0) - (countByEmployeeId.get(a.id) ?? 0);
    if (countDiff !== 0) return countDiff;
    return compareProfilesByFirstName(a, b);
  });
}
