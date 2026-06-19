import type { CommunicationHubCategory } from "@/lib/communication-hub";

export type CommunicationTabAction =
  | "delete"
  | "cancel"
  | "reassign"
  | "requestConfirmation";

const CATEGORY_ACTIONS: Record<
  CommunicationHubCategory,
  readonly CommunicationTabAction[]
> = {
  conflicts: ["reassign", "cancel", "delete"],
  swaps: [],
  proposed: ["delete"],
  requested: ["cancel"],
  rejected: ["reassign", "delete"],
  pending: ["cancel", "requestConfirmation"],
  canceled: ["reassign", "delete"],
};

export function communicationTabActions(
  category: CommunicationHubCategory
): readonly CommunicationTabAction[] {
  return CATEGORY_ACTIONS[category];
}

export function communicationTabShowsSelection(
  category: CommunicationHubCategory
): boolean {
  return communicationTabActions(category).length > 0;
}

export function communicationActionRequiresExactlyOneSelection(
  action: CommunicationTabAction
): boolean {
  return action === "reassign";
}
