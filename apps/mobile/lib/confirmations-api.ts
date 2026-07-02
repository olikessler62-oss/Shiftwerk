import type {
  ConfirmationRespondBody,
  ConfirmationWeekResponse,
  EmployeeWeekShiftDisplayItem,
} from "@schichtwerk/types";
import { fetchMobileApi } from "@/lib/mobile-api-client";

export async function fetchMyShiftWeekDisplay(
  from: string,
  to: string
): Promise<EmployeeWeekShiftDisplayItem[]> {
  const params = new URLSearchParams({ from, to });
  const response = await fetchMobileApi<{ items: EmployeeWeekShiftDisplayItem[] }>(
    `/api/mobile/shifts/week-display?${params.toString()}`
  );
  return response.items;
}

export async function fetchConfirmationWeek(
  from: string,
  to: string
): Promise<ConfirmationWeekResponse> {
  const params = new URLSearchParams({ from, to });
  return fetchMobileApi<ConfirmationWeekResponse>(
    `/api/mobile/confirmations/week?${params.toString()}`
  );
}

export async function fetchPendingConfirmations(): Promise<ConfirmationWeekResponse> {
  return fetchMobileApi<ConfirmationWeekResponse>(
    "/api/mobile/confirmations/pending"
  );
}

export async function submitConfirmationResponses(
  items: ConfirmationRespondBody["items"]
): Promise<{ ok: true; updatedCount: number }> {
  return fetchMobileApi<{ ok: true; updatedCount: number }>(
    "/api/mobile/confirmations/respond",
    {
      method: "POST",
      body: JSON.stringify({
        items: items.map((item) => {
          const trimmed = item.reason?.trim();
          return {
            shiftId: item.shiftId,
            decision: item.decision,
            ...(item.decision === "reject" && trimmed
              ? { reason: trimmed, rejection_reason: trimmed }
              : {}),
          };
        }),
      }),
    }
  );
}

export async function cancelConfirmationShift(
  shiftId: string,
  reason?: string
): Promise<{ ok: true }> {
  const trimmed = reason?.trim();
  return fetchMobileApi<{ ok: true }>("/api/mobile/confirmations/cancel", {
    method: "POST",
    body: JSON.stringify({
      shiftId,
      ...(trimmed
        ? { reason: trimmed, cancellation_reason: trimmed }
        : {}),
    }),
  });
}

export async function dismissCanceledShift(
  shiftId: string
): Promise<{ ok: true }> {
  return fetchMobileApi<{ ok: true }>("/api/mobile/confirmations/dismiss", {
    method: "POST",
    body: JSON.stringify({ shiftId }),
  });
}
