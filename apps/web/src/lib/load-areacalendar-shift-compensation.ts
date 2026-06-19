import type { SchichtwerkDatabase } from "@/lib/db";
import { splitShiftWindowIntoCalendarDaySegments } from "@schichtwerk/database";
import {
  DEFAULT_ORGANIZATION_CURRENCY,
  type AreaCalendarShiftCompensationByKey,
  type TagAreaShiftRef,
  shiftCompensationKey,
} from "@/lib/tag-area-footer-stats";

export async function loadAreaCalendarShiftCompensation(
  db: SchichtwerkDatabase,
  organizationId: string,
  shifts: readonly TagAreaShiftRef[]
): Promise<AreaCalendarShiftCompensationByKey> {
  const pairs = new Map<
    string,
    { employeeId: string; dateISO: string }
  >();

  for (const shift of shifts) {
    const segments = splitShiftWindowIntoCalendarDaySegments({
      shiftDate: shift.shift_date,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
    for (const segment of segments) {
      pairs.set(shiftCompensationKey(shift.employeeId, segment.dateISO), {
        employeeId: shift.employeeId,
        dateISO: segment.dateISO,
      });
    }
  }

  if (pairs.size === 0) return {};

  const datesNeeded = [...new Set([...pairs.values()].map((pair) => pair.dateISO))];
  const ratesByDate = new Map<
    string,
    Map<string, { amount: number; currency: string }>
  >();

  for (const dateISO of datesNeeded) {
    const rates = await db.listCurrentOrganizationProfileHourlyRates(
      organizationId,
      dateISO
    );
    ratesByDate.set(
      dateISO,
      new Map(
        rates.map((rate) => [
          rate.profile_id,
          {
            amount: rate.amount,
            currency: rate.currency || DEFAULT_ORGANIZATION_CURRENCY,
          },
        ])
      )
    );
  }

  const result: AreaCalendarShiftCompensationByKey = {};

  await Promise.all(
    [...pairs.values()].map(async ({ employeeId, dateISO }) => {
      const rate = ratesByDate.get(dateISO)?.get(employeeId);
      const key = shiftCompensationKey(employeeId, dateISO);
      if (!rate) {
        result[key] = undefined;
        return;
      }
      const surcharges = await db.listEffectiveProfileCompensationSurchargesForDate(
        organizationId,
        employeeId,
        dateISO
      );
      result[key] = {
        baseHourlyRate: rate.amount,
        currency: rate.currency,
        surcharges,
      };
    })
  );

  return result;
}
