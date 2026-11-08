import { describe, expect, it } from "vitest";
import { calculateSavings, DEFAULT_SAVINGS } from "./savings";
const start = new Date("2026-11-01T00:00:00Z");
const end = new Date("2026-12-01T00:00:00Z");
describe("activity-based savings", () => {
  it("uses recorded activity and adjustable time assumptions", () => {
    const activity = [
      { kind: "paperwork", created_at: "2026-11-02" },
      { kind: "ai_answer", created_at: "2026-11-03" },
    ];
    const result = calculateSavings(
      activity,
      { ...DEFAULT_SAVINGS, paperwork_minutes: 6, ai_minutes: 12, hourly_cost: 30 },
      start,
      end,
    );
    expect(result.hours).toBe(0.3);
    expect(result.gross).toBe(9);
  });
  it("subtracts service costs, including negative net savings", () => {
    expect(
      calculateSavings([], { ...DEFAULT_SAVINGS, monthly_service_cost: 100 }, start, end).net,
    ).toBe(-100);
  });
  it("does not infer savings from sample records or activity outside the period", () => {
    expect(
      calculateSavings(
        [
          { kind: "paperwork", created_at: "2026-10-31" },
          { kind: "seed", created_at: "2026-11-02" },
        ],
        DEFAULT_SAVINGS,
        start,
        end,
      ).hours,
    ).toBe(0);
  });
});
