import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type { AbsenceRequest } from "@schichtwerk/types";

import {
  SHIFT_CONFIRMATION_CANCELED_TAB_LABEL_CLASS,
  SHIFT_CONFIRMATION_PENDING_TAB_LABEL_CLASS,
  SHIFT_CONFIRMATION_PROPOSED_TAB_LABEL_CLASS,
  SHIFT_CONFIRMATION_REJECTED_TAB_LABEL_CLASS,
  SHIFT_CONFIRMATION_REQUESTED_TAB_LABEL_CLASS,
} from "@/lib/shift-confirmation-display";
import {
  collectShiftAbsenceConflicts,
  type ShiftAbsenceConflict,
} from "@/lib/shift-absence-conflict";

export type CommunicationResponseTab =
  | "pending"
  | "rejected"
  | "proposed"
  | "requested"
  | "canceled";

/** Erweiterte Kategorien im Schicht-Stati-Modal (Handlungsbedarf zuerst). */
export type CommunicationHubCategory =
  | "conflicts"
  | "swaps"
  | CommunicationResponseTab;

export const COMMUNICATION_HUB_CATEGORY_ORDER = [
  "conflicts",
  "swaps",
  "canceled",
  "rejected",
  "pending",
  "proposed",
  "requested",
] as const satisfies readonly CommunicationHubCategory[];

/** @deprecated Nutze {@link COMMUNICATION_HUB_CATEGORY_ORDER}. */
export const COMMUNICATION_RESPONSE_TAB_ORDER = [
  "proposed",
  "requested",
  "rejected",
  "pending",
  "canceled",
] as const satisfies readonly CommunicationResponseTab[];

export type CommunicationOpenOptions = {
  category?: CommunicationHubCategory;
  /** @deprecated Nutze category. */
  responseTab?: CommunicationResponseTab;
};

export type CommunicationSwapRequestRow = {
  id: string;
  status: import("@schichtwerk/types").SwapRequestStatus;
  message: string | null;
  requesterId: string;
  requesterName: string;
  targetEmployeeId: string | null;
  targetEmployeeName: string | null;
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftName: string;
  assigneeName: string;
  locationAreaId: string | null;
  locationId: string | null;
};

export type CommunicationHubCounts = Record<CommunicationHubCategory, number>;

export const COMMUNICATION_CONFLICTS_PANEL_CLASS =
  "border-rose-200 bg-rose-50 text-rose-900";

export const COMMUNICATION_SWAPS_PANEL_CLASS =
  "border-violet-200 bg-violet-50 text-violet-900";

export function communicationHubCategoryLabelClass(
  category: CommunicationHubCategory
): string {
  if (category === "conflicts") return "text-rose-800";
  if (category === "swaps") return "text-violet-800";
  return communicationResponseTabLabelClass(category);
}

export function communicationHubCategoryPanelClass(
  category: CommunicationHubCategory
): string {
  if (category === "conflicts") return COMMUNICATION_CONFLICTS_PANEL_CLASS;
  if (category === "swaps") return COMMUNICATION_SWAPS_PANEL_CLASS;

  switch (category) {
    case "rejected":
      return "border-red-200 bg-red-50 text-red-900";
    case "pending":
      return "border-fuchsia-200 bg-fuchsia-50 text-[#701a75]";
    case "proposed":
      return "border-neutral-200 bg-neutral-50 text-neutral-950";
    case "requested":
      return "border-amber-200 bg-amber-50 text-[#7A5A10]";
    case "canceled":
      return "border-orange-200 bg-orange-50 text-orange-800";
  }
}

export function communicationResponseTabLabelClass(
  tab: CommunicationResponseTab
): string {
  switch (tab) {
    case "rejected":
      return SHIFT_CONFIRMATION_REJECTED_TAB_LABEL_CLASS;
    case "pending":
      return SHIFT_CONFIRMATION_PENDING_TAB_LABEL_CLASS;
    case "proposed":
      return SHIFT_CONFIRMATION_PROPOSED_TAB_LABEL_CLASS;
    case "requested":
      return SHIFT_CONFIRMATION_REQUESTED_TAB_LABEL_CLASS;
    case "canceled":
      return SHIFT_CONFIRMATION_CANCELED_TAB_LABEL_CLASS;
  }
}

export function communicationResponseTabForStatus(
  status: AreaCalendarShiftCard["confirmationStatus"]
): CommunicationResponseTab | null {
  if (
    status === "pending" ||
    status === "rejected" ||
    status === "proposed" ||
    status === "requested" ||
    status === "canceled"
  ) {
    return status;
  }

  return null;
}

export type CommunicationGroupedShifts = {
  pending: AreaCalendarShiftCard[];
  rejected: AreaCalendarShiftCard[];
  proposed: AreaCalendarShiftCard[];
  requested: AreaCalendarShiftCard[];
  /** Nur vom Mitarbeiter abgesagte Schichten (Handlungsbedarf für Admin). */
  canceled: AreaCalendarShiftCard[];
};

export type CommunicationHubGroupedData = CommunicationGroupedShifts & {
  conflicts: AreaCalendarShiftCard[];
  conflictDetailsByShiftId: Map<string, ShiftAbsenceConflict>;
  swaps: CommunicationSwapRequestRow[];
};

function sortShiftsByDateThenName(
  a: AreaCalendarShiftCard,
  b: AreaCalendarShiftCard
): number {
  const dateDiff = a.shift_date.localeCompare(b.shift_date);
  if (dateDiff !== 0) return dateDiff;
  return a.employeeName.localeCompare(b.employeeName, "de");
}

export function groupCommunicationResponseShifts(
  shifts: readonly AreaCalendarShiftCard[],
  options?: {
    cancelActors?: ReadonlyMap<string, "employee" | "manager">;
  }
): CommunicationGroupedShifts {
  const cancelActors = options?.cancelActors;

  const pending: AreaCalendarShiftCard[] = [];
  const rejected: AreaCalendarShiftCard[] = [];
  const proposed: AreaCalendarShiftCard[] = [];
  const requested: AreaCalendarShiftCard[] = [];
  const canceled: AreaCalendarShiftCard[] = [];

  for (const shift of shifts) {
    const tab = communicationResponseTabForStatus(shift.confirmationStatus);
    if (tab === "pending") pending.push(shift);
    else if (tab === "rejected") rejected.push(shift);
    else if (tab === "proposed") proposed.push(shift);
    else if (tab === "requested") requested.push(shift);
    else if (tab === "canceled") {
      const actor = cancelActors?.get(shift.id);
      if (actor === "manager") continue;
      canceled.push(shift);
    }
  }

  pending.sort(sortShiftsByDateThenName);
  rejected.sort(sortShiftsByDateThenName);
  proposed.sort(sortShiftsByDateThenName);
  requested.sort(sortShiftsByDateThenName);
  canceled.sort(sortShiftsByDateThenName);

  return { pending, rejected, proposed, requested, canceled };
}

export function groupCommunicationHubData(
  shifts: readonly AreaCalendarShiftCard[],
  options?: {
    absences?: readonly AbsenceRequest[];
    swapRequests?: readonly CommunicationSwapRequestRow[];
    cancelActors?: ReadonlyMap<string, "employee" | "manager">;
  }
): CommunicationHubGroupedData {
  const grouped = groupCommunicationResponseShifts(shifts, options);
  const absences = options?.absences ?? [];
  const swapRequests = [...(options?.swapRequests ?? [])].filter(
    (row) => row.status === "pending"
  );

  swapRequests.sort((a, b) => {
    const dateDiff = a.shiftDate.localeCompare(b.shiftDate);
    if (dateDiff !== 0) return dateDiff;
    return a.requesterName.localeCompare(b.requesterName, "de");
  });

  const conflictRecords = collectShiftAbsenceConflicts(
    shifts.map((shift) => ({
      id: shift.id,
      employeeId: shift.employeeId,
      shift_date: shift.shift_date,
    })),
    absences
  );

  const conflictDetailsByShiftId = new Map(
    conflictRecords.map((record) => [record.shiftId, record])
  );

  const conflicts = shifts
    .filter((shift) => conflictDetailsByShiftId.has(shift.id))
    .sort(sortShiftsByDateThenName);

  return {
    ...grouped,
    conflicts,
    conflictDetailsByShiftId,
    swaps: swapRequests,
  };
}

export function communicationHubCounts(
  grouped: CommunicationHubGroupedData
): CommunicationHubCounts {
  return {
    conflicts: grouped.conflicts.length,
    swaps: grouped.swaps.length,
    canceled: grouped.canceled.length,
    rejected: grouped.rejected.length,
    pending: grouped.pending.length,
    proposed: grouped.proposed.length,
    requested: grouped.requested.length,
  };
}

export function countCommunicationActionItems(
  shifts: readonly AreaCalendarShiftCard[],
  options?: {
    absences?: readonly AbsenceRequest[];
    swapRequests?: readonly CommunicationSwapRequestRow[];
    cancelActors?: ReadonlyMap<string, "employee" | "manager">;
  }
): number {
  const grouped = groupCommunicationHubData(shifts, options);
  const counts = communicationHubCounts(grouped);
  return (
    counts.conflicts +
    counts.swaps +
    counts.canceled +
    counts.rejected +
    counts.pending +
    counts.proposed +
    counts.requested
  );
}

export function resolveDefaultCommunicationHubCategory(
  shifts: readonly AreaCalendarShiftCard[],
  options?: Parameters<typeof groupCommunicationHubData>[1]
): CommunicationHubCategory {
  const grouped = groupCommunicationHubData(shifts, options);
  const counts = communicationHubCounts(grouped);
  for (const category of COMMUNICATION_HUB_CATEGORY_ORDER) {
    if (counts[category] > 0) return category;
  }
  return "conflicts";
}

/** @deprecated Nutze {@link resolveDefaultCommunicationHubCategory}. */
export function resolveDefaultCommunicationResponseTab(
  shifts: readonly AreaCalendarShiftCard[]
): CommunicationResponseTab {
  return resolveDefaultCommunicationHubCategory(shifts) as CommunicationResponseTab;
}

export function defaultSelectedResponseShiftIds(
  category: CommunicationHubCategory,
  shifts: readonly AreaCalendarShiftCard[],
  options?: Parameters<typeof groupCommunicationHubData>[1]
): Set<string> {
  const grouped = groupCommunicationHubData(shifts, options);

  if (category === "conflicts") {
    return new Set(grouped.conflicts.map((shift) => shift.id));
  }

  if (category === "swaps") {
    return new Set();
  }

  const visible = grouped[category as keyof CommunicationGroupedShifts] as
    | AreaCalendarShiftCard[]
    | undefined;

  if (!visible) return new Set();

  if (
    category === "rejected" ||
    category === "requested" ||
    category === "canceled"
  ) {
    return new Set();
  }

  return new Set(visible.map((shift) => shift.id));
}

export type CommunicationAreaGroup = {
  areaId: string | null;
  shifts: AreaCalendarShiftCard[];
};

export const COMMUNICATION_LIST_ROW_HEIGHT_PX = 40;
export const COMMUNICATION_LIST_SCROLL_THRESHOLD = 10;

export function groupCommunicationShiftsByArea(
  shifts: readonly AreaCalendarShiftCard[],
  areas: readonly { id: string; name: string }[]
): CommunicationAreaGroup[] {
  const byAreaId = new Map<string | null, AreaCalendarShiftCard[]>();

  for (const shift of shifts) {
    const key = shift.locationAreaId ?? null;
    const list = byAreaId.get(key) ?? [];
    list.push(shift);
    byAreaId.set(key, list);
  }

  const groups: CommunicationAreaGroup[] = [];

  for (const area of areas) {
    const areaShifts = byAreaId.get(area.id);
    if (!areaShifts?.length) continue;
    groups.push({ areaId: area.id, shifts: areaShifts });
    byAreaId.delete(area.id);
  }

  const remaining = [...byAreaId.entries()].sort(([a], [b]) => {
    const aKey = a ?? "";
    const bKey = b ?? "";
    return aKey.localeCompare(bKey);
  });

  for (const [areaId, areaShifts] of remaining) {
    if (areaShifts.length > 0) {
      groups.push({ areaId, shifts: areaShifts });
    }
  }

  return groups;
}

export function countCommunicationListRows(
  groups: readonly CommunicationAreaGroup[]
): number {
  return groups.reduce((sum, group) => sum + 1 + group.shifts.length, 0);
}

export function resolveCommunicationOpenCategory(
  options?: CommunicationOpenOptions
): CommunicationHubCategory | undefined {
  const requested = options?.category ?? options?.responseTab;
  if ((requested as string | undefined) === "confirmed") return undefined;
  return requested;
}