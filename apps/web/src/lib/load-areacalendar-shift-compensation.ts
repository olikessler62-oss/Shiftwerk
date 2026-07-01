import type { SchichtwerkDatabase } from "@/lib/db";
import { splitShiftWindowIntoCalendarDaySegments } from "@schichtwerk/database";
import type {
  EffectiveProfileCompensationSurcharge,
  ProfileCompensationSurcharge,
  ProfileHourlyRate,
} from "@schichtwerk/types";
import {
  DEFAULT_ORGANIZATION_CURRENCY,
  type AreaCalendarShiftCompensationByKey,
  type TagAreaShiftRef,
  shiftCompensationKey,
} from "@/lib/tag-area-footer-stats";

function isEffectiveOnDate(
  validFrom: string,
  validTo: string | null,
  dateISO: string
): boolean {
  return validFrom <= dateISO && (!validTo || validTo >= dateISO);
}

function hourlyRateForDate(
  rates: readonly ProfileHourlyRate[],
  profileId: string,
  dateISO: string
): { amount: number; currency: string } | null {
  const match = rates
    .filter(
      (rate) =>
        rate.profile_id === profileId &&
        isEffectiveOnDate(rate.valid_from, rate.valid_to, dateISO)
    )
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];

  if (!match) return null;
  return {
    amount: match.amount,
    currency: match.currency || DEFAULT_ORGANIZATION_CURRENCY,
  };
}

function effectiveSurchargesForDate(
  surcharges: readonly ProfileCompensationSurcharge[],
  profileId: string,
  dateISO: string
): EffectiveProfileCompensationSurcharge[] {
  const byType = new Map<string, ProfileCompensationSurcharge>();

  for (const row of surcharges) {
    if (row.profile_id !== profileId) continue;
    if (!isEffectiveOnDate(row.valid_from, row.valid_to, dateISO)) continue;
    const existing = byType.get(row.surcharge_type_id);
    if (!existing || row.valid_from > existing.valid_from) {
      byType.set(row.surcharge_type_id, row);
    }
  }

  return [...byType.values()].map((row) => ({
    id: row.id,
    surcharge_type_id: row.surcharge_type_id,
    name: row.surcharge_type_name,
    trigger: row.trigger,
    amount: row.amount ?? row.type_default_amount,
    unit: row.unit ?? row.type_default_unit,
  }));
}

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

  const [allRates, allSurcharges] = await Promise.all([
    db.listAllOrganizationProfileHourlyRates(organizationId),
    db.listAllOrganizationProfileCompensationSurcharges(organizationId),
  ]);

  const result: AreaCalendarShiftCompensationByKey = {};

  for (const { employeeId, dateISO } of pairs.values()) {
    const key = shiftCompensationKey(employeeId, dateISO);
    const rate = hourlyRateForDate(allRates, employeeId, dateISO);
    if (!rate) {
      result[key] = undefined;
      continue;
    }
    result[key] = {
      baseHourlyRate: rate.amount,
      currency: rate.currency,
      surcharges: effectiveSurchargesForDate(allSurcharges, employeeId, dateISO),
    };
  }

  return result;
}
