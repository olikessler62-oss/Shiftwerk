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
