import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import {
  SHIFT_CONFIRMATION_PENDING_TAB_LABEL_CLASS,
  SHIFT_CONFIRMATION_PROPOSED_TAB_LABEL_CLASS,
  SHIFT_CONFIRMATION_REJECTED_TAB_LABEL_CLASS,
  SHIFT_CONFIRMATION_REQUESTED_TAB_LABEL_CLASS,
} from "@/lib/shift-confirmation-display";

export type CommunicationResponseTab =
  | "pending"
  | "rejected"
  | "proposed"
  | "requested";

/** Priorität links → rechts; „Nicht versendet“ ganz rechts. */
export const COMMUNICATION_RESPONSE_TAB_ORDER = [
  "rejected",
  "pending",
  "requested",
  "proposed",
] as const satisfies readonly CommunicationResponseTab[];

export type CommunicationOpenOptions = {
  responseTab?: CommunicationResponseTab;
};

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
  }
}

export function communicationTabShowsSelection(tab: CommunicationResponseTab): boolean {
  return tab !== "requested";
}

export function communicationTabHasActionButton(tab: CommunicationResponseTab): boolean {
  return tab !== "requested";
}

export function communicationResponseTabForStatus(
  status: DashboardShiftCard["confirmationStatus"]
): CommunicationResponseTab | null {
  if (
    status === "pending" ||
    status === "rejected" ||
    status === "proposed" ||
    status === "requested"
  ) {
    return status;
  }
  return null;
}

export function groupCommunicationResponseShifts(shifts: readonly DashboardShiftCard[]) {
  const pending: DashboardShiftCard[] = [];
  const rejected: DashboardShiftCard[] = [];
  const proposed: DashboardShiftCard[] = [];
  const requested: DashboardShiftCard[] = [];

  for (const shift of shifts) {
    const tab = communicationResponseTabForStatus(shift.confirmationStatus);
    if (tab === "pending") pending.push(shift);
    else if (tab === "rejected") rejected.push(shift);
    else if (tab === "proposed") proposed.push(shift);
    else if (tab === "requested") requested.push(shift);
  }

  const byDateThenName = (a: DashboardShiftCard, b: DashboardShiftCard) => {
    const dateDiff = a.shift_date.localeCompare(b.shift_date);
    if (dateDiff !== 0) return dateDiff;
    return a.employeeName.localeCompare(b.employeeName, "de");
  };

  pending.sort(byDateThenName);
  rejected.sort(byDateThenName);
  proposed.sort(byDateThenName);
  requested.sort(byDateThenName);

  return { pending, rejected, proposed, requested };
}

export function countCommunicationActionItems(shifts: readonly DashboardShiftCard[]): number {
  return shifts.filter(
    (shift) =>
      shift.confirmationStatus === "pending" ||
      shift.confirmationStatus === "rejected" ||
      shift.confirmationStatus === "proposed" ||
      shift.confirmationStatus === "requested"
  ).length;
}

export function resolveDefaultCommunicationResponseTab(
  shifts: readonly DashboardShiftCard[]
): CommunicationResponseTab {
  const grouped = groupCommunicationResponseShifts(shifts);
  if (grouped.rejected.length > 0) return "rejected";
  if (grouped.pending.length > 0) return "pending";
  if (grouped.requested.length > 0) return "requested";
  if (grouped.proposed.length > 0) return "proposed";
  return "rejected";
}

export function defaultSelectedResponseShiftIds(
  tab: CommunicationResponseTab,
  shifts: readonly DashboardShiftCard[]
): Set<string> {
  const grouped = groupCommunicationResponseShifts(shifts);
  const visible = grouped[tab];
  if (tab === "rejected") return new Set();
  return new Set(visible.map((shift) => shift.id));
}

export type CommunicationAreaGroup = {
  areaId: string | null;
  shifts: DashboardShiftCard[];
};

export const COMMUNICATION_LIST_ROW_HEIGHT_PX = 40;
export const COMMUNICATION_LIST_SCROLL_THRESHOLD = 10;

export function groupCommunicationShiftsByArea(
  shifts: readonly DashboardShiftCard[],
  areas: readonly { id: string; name: string }[]
): CommunicationAreaGroup[] {
  const byAreaId = new Map<string | null, DashboardShiftCard[]>();

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
