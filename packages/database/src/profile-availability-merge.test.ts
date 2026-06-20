import { describe, expect, it } from "vitest";
import {
  areAdjacentAvailabilitySlots,
  planAdjacentProfileAvailabilityMerges,
  type ProfileAvailabilityMergeSlot,
} from "./profile-availability-merge";

function slot(
  overrides: Pick<ProfileAvailabilityMergeSlot, "id" | "weekday" | "start_time" | "end_time">
): ProfileAvailabilityMergeSlot {
  return {
    id: overrides.id,
    weekday: overrides.weekday,
    start_time:
      overrides.start_time.length === 5 ? `${overrides.start_time}:00` : overrides.start_time,
    end_time:
      overrides.end_time.length === 5 ? `${overrides.end_time}:00` : overrides.end_time,
  };
}

describe("profile availability merge", () => {
  it("merges slots that touch at the end/start boundary", () => {
    expect(
      planAdjacentProfileAvailabilityMerges([
        slot({ id: "a", weekday: 1, start_time: "03:00", end_time: "06:00" }),
        slot({ id: "b", weekday: 1, start_time: "06:00", end_time: "12:00" }),
      ])
    ).toEqual([
      {
        keepId: "a",
        deleteIds: ["b"],
        weekday: 1,
        start_time: "03:00:00",
        end_time: "12:00:00",
      },
    ]);
  });

  it("keeps slots separate when there is a one-minute gap", () => {
    expect(
      planAdjacentProfileAvailabilityMerges([
        slot({ id: "a", weekday: 1, start_time: "03:00", end_time: "06:00" }),
        slot({ id: "b", weekday: 1, start_time: "06:01", end_time: "12:00" }),
      ])
    ).toEqual([]);
  });

  it("merges chains of three or more adjacent slots", () => {
    expect(
      planAdjacentProfileAvailabilityMerges([
        slot({ id: "a", weekday: 2, start_time: "03:00", end_time: "06:00" }),
        slot({ id: "b", weekday: 2, start_time: "06:00", end_time: "09:00" }),
        slot({ id: "c", weekday: 2, start_time: "09:00", end_time: "12:00" }),
      ])
    ).toEqual([
      {
        keepId: "a",
        deleteIds: ["b", "c"],
        weekday: 2,
        start_time: "03:00:00",
        end_time: "12:00:00",
      },
    ]);
  });

  it("does not merge overnight slots", () => {
    expect(
      areAdjacentAvailabilitySlots(
        { start_time: "22:00:00", end_time: "06:00:00" },
        { start_time: "06:00:00", end_time: "12:00:00" }
      )
    ).toBe(false);
    expect(
      planAdjacentProfileAvailabilityMerges([
        slot({ id: "a", weekday: 1, start_time: "22:00", end_time: "06:00" }),
        slot({ id: "b", weekday: 1, start_time: "06:00", end_time: "12:00" }),
      ])
    ).toEqual([]);
  });

  it("merges per weekday independently", () => {
    expect(
      planAdjacentProfileAvailabilityMerges([
        slot({ id: "a", weekday: 1, start_time: "08:00", end_time: "12:00" }),
        slot({ id: "b", weekday: 1, start_time: "12:00", end_time: "16:00" }),
        slot({ id: "c", weekday: 2, start_time: "08:00", end_time: "12:00" }),
        slot({ id: "d", weekday: 2, start_time: "13:00", end_time: "17:00" }),
      ])
    ).toEqual([
      {
        keepId: "a",
        deleteIds: ["b"],
        weekday: 1,
        start_time: "08:00:00",
        end_time: "16:00:00",
      },
    ]);
  });
});
