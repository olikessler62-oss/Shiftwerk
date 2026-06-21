import { fetchMobileApi } from "@/lib/mobile-api-client";
import type { AbsenceType, RequestStatus } from "@schichtwerk/types";

export type MobileAbsenceItem = {
  id: string;
  type: AbsenceType;
  startDate: string;
  endDate: string | null;
  isOpenEnded: boolean;
  expectedEndDate: string | null;
  status: RequestStatus;
  notes: string | null;
  updatedAt: string;
};

export type MobileAbsenceListResponse = {
  absences: MobileAbsenceItem[];
};

export type CreateMobileAbsenceInput = {
  type: AbsenceType;
  startDate: string;
  endDate?: string | null;
  isOpenEnded: boolean;
  expectedEndDate?: string | null;
  notes?: string | null;
};

export async function fetchMobileAbsences(): Promise<MobileAbsenceListResponse> {
  return fetchMobileApi<MobileAbsenceListResponse>("/api/mobile/absences");
}

export async function reportAbsence(
  input: CreateMobileAbsenceInput
): Promise<{ ok: true; id: string; shiftConflictCount: number; status: RequestStatus }> {
  return fetchMobileApi<{ ok: true; id: string; shiftConflictCount: number; status: RequestStatus }>(
    "/api/mobile/absences",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

/** @deprecated Use reportAbsence */
export const reportSickAbsence = reportAbsence;

export async function cancelPendingAbsence(id: string): Promise<{ ok: true; id: string }> {
  return fetchMobileApi<{ ok: true; id: string }>(`/api/mobile/absences/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "cancel" }),
  });
}

export async function closeOpenSickAbsence(
  id: string,
  endDate: string
): Promise<{ ok: true; id: string }> {
  return fetchMobileApi<{ ok: true; id: string }>(`/api/mobile/absences/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "closeSick", endDate }),
  });
}

export async function extendAbsenceExpectedEnd(
  id: string,
  expectedEndDate: string | null
): Promise<{ ok: true; id: string }> {
  return fetchMobileApi<{ ok: true; id: string }>(`/api/mobile/absences/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "extend", expectedEndDate }),
  });
}
