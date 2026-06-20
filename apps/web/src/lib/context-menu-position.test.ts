import { afterEach, describe, expect, it, vi } from "vitest";

import { clampContextMenuPosition } from "./context-menu-position";

describe("clampContextMenuPosition", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the menu inside the viewport when opened near the bottom edge", () => {
    vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 800 });

    const position = clampContextMenuPosition(400, 780, 240, 220, 8);

    expect(position.x).toBe(400);
    expect(position.y).toBe(572);
    expect(position.y + 220).toBeLessThanOrEqual(800 - 8);
  });

  it("keeps the menu inside the viewport when opened near the right edge", () => {
    vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 800 });

    const position = clampContextMenuPosition(1100, 200, 240, 180, 8);

    expect(position.x).toBe(952);
    expect(position.x + 240).toBeLessThanOrEqual(1200 - 8);
    expect(position.y).toBe(200);
  });
});
