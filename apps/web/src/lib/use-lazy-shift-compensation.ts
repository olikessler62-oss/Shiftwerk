"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DashboardShiftCompensationByKey,
  TagAreaShiftRef,
} from "@/lib/tag-area-footer-stats";

export function useLazyShiftCompensation(
  shifts: readonly TagAreaShiftRef[]
): DashboardShiftCompensationByKey {
  const [compensation, setCompensation] =
    useState<DashboardShiftCompensationByKey>({});

  const requestKey = useMemo(
    () =>
      shifts
        .map(
          (shift) =>
            `${shift.employeeId}:${shift.shift_date}:${shift.startTime}:${shift.endTime}`
        )
        .join("|"),
    [shifts]
  );

  useEffect(() => {
    if (shifts.length === 0) {
      setCompensation({});
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    void fetch("/api/dashboard/shift-compensation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return {};
        const data: unknown = await response.json();
        if (typeof data !== "object" || data === null) return {};
        return data as DashboardShiftCompensationByKey;
      })
      .then((data) => {
        if (!cancelled) setCompensation(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!cancelled) setCompensation({});
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey, shifts]);

  return compensation;
}
