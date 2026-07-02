export const PLANNING_POST_LOGIN_PENDING_KEY = "planning-post-login-pending";

export function markPlanningPostLoginPending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PLANNING_POST_LOGIN_PENDING_KEY, "1");
}

export function consumePlanningPostLoginPending(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(PLANNING_POST_LOGIN_PENDING_KEY) !== "1") {
    return false;
  }
  sessionStorage.removeItem(PLANNING_POST_LOGIN_PENDING_KEY);
  return true;
}
