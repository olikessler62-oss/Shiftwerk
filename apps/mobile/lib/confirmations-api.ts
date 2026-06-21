import type {
  ConfirmationRespondBody,
  ConfirmationWeekResponse,
} from "@schichtwerk/types";
import { fetchMobileApi } from "@/lib/mobile-api-client";

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
      body: JSON.stringify({ items }),
    }
  );
}

export async function cancelConfirmationShift(
  shiftId: string
): Promise<{ ok: true }> {
  return fetchMobileApi<{ ok: true }>("/api/mobile/confirmations/cancel", {
    method: "POST",
    body: JSON.stringify({ shiftId }),
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
