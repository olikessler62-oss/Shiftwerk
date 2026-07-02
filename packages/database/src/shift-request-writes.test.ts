import { describe, expect, it, vi } from "vitest";
import { updateOpenEmployeeCancellationRequestReason } from "./shift-request-writes";

describe("updateOpenEmployeeCancellationRequestReason", () => {
  it("merges reason into pending employee cancellation payload", async () => {
    const update = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "req-1",
              payload: { cancelled_by: "employee", source: "mobile_cancel" },
            },
            error: null,
          }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockImplementation(() => {
            update();
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    };

    const updated = await updateOpenEmployeeCancellationRequestReason({
      client: client as never,
      organizationId: "org-1",
      shiftId: "shift-1",
      reason: "Kurzfristig krank",
      now: "2026-07-02T14:00:00.000Z",
    });

    expect(updated).toBe(true);
    expect(update).toHaveBeenCalled();
    expect(client.from).toHaveBeenCalled();
  });
});
