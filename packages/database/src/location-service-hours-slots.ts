import { serviceHourTimeSegments } from "./location-service-hours-validation";

export type ServiceHourSlotTime = {
  start_time: string;
  end_time: string;
};

const DAY_END_MINUTES = 23 * 60 + 59;

type MinuteInterval = { startMin: number; endMin: number };
type MinuteGap = { startMin: number; endMin: number };

function minutesToTimeField(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function validSlotIntervals(slots: ServiceHourSlotTime[]): MinuteInterval[] {
  return slots
    .flatMap((slot) =>
      serviceHourTimeSegments(slot.start_time, slot.end_time).map((segment) => ({
        startMin: segment.start,
        endMin: segment.end,
      }))
    )
    .filter((interval) => interval.endMin > interval.startMin)
    .sort((a, b) => a.startMin - b.startMin);
}

/** Freie Zeitfenster am Tag, in denen ein weiteres Servicefenster passt. */
export function findServiceHourGaps(slots: ServiceHourSlotTime[]): MinuteGap[] {
  const intervals = validSlotIntervals(slots);
  const gaps: MinuteGap[] = [];
  let cursor = 0;

  for (const interval of intervals) {
    if (interval.startMin > cursor) {
      gaps.push({ startMin: cursor, endMin: interval.startMin });
    }
    cursor = Math.max(cursor, interval.endMin);
  }

  if (cursor < DAY_END_MINUTES) {
    gaps.push({ startMin: cursor, endMin: DAY_END_MINUTES });
  }

  return gaps.filter((gap) => gap.endMin > gap.startMin);
}

export function canAddServiceHourSlot(slots: ServiceHourSlotTime[]): boolean {
  return findServiceHourGaps(slots).length > 0;
}

/**
 * Nächstes Zeitfenster ohne Überschneidung.
 * Vorrang: Anschluss an die zuletzt endende Servicezeit, sonst davor, sonst dazwischen.
 */
export function suggestNextServiceHourSlot(
  slots: ServiceHourSlotTime[]
): { start_time: string; end_time: string } | null {
  const gaps = findServiceHourGaps(slots);
  if (gaps.length === 0) return null;

  const intervals = validSlotIntervals(slots);
  if (intervals.length === 0) {
    return { start_time: "00:00", end_time: "23:59" };
  }

  const lastEnd = Math.max(...intervals.map((interval) => interval.endMin));
  const afterLast = gaps.find((gap) => gap.startMin === lastEnd);
  if (afterLast) {
    return {
      start_time: minutesToTimeField(afterLast.startMin),
      end_time: minutesToTimeField(afterLast.endMin),
    };
  }

  const firstStart = Math.min(...intervals.map((interval) => interval.startMin));
  const beforeFirst = gaps.find((gap) => gap.endMin === firstStart);
  if (beforeFirst) {
    return {
      start_time: minutesToTimeField(beforeFirst.startMin),
      end_time: minutesToTimeField(beforeFirst.endMin),
    };
  }

  const middleGap = gaps[0]!;
  return {
    start_time: minutesToTimeField(middleGap.startMin),
    end_time: minutesToTimeField(middleGap.endMin),
  };
}
