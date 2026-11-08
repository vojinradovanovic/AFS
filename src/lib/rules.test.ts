import { describe, expect, it } from "vitest";
import { failureRisk, flagBatchSheet, flagChangeover, flagWeightCheck, hoursToPm, riskLevel } from "./rules";

describe("paperwork flags", () => {
  it("flags a weight sample below target minus tolerance", () => {
    expect(flagWeightCheck({ target: 340, tolerance: 5, samples: [341, 333] })).toEqual([
      "Sample 2 (333 g) is below the 335 g minimum",
    ]);
  });
  it("accepts samples exactly at the tolerance edge", () => {
    expect(flagWeightCheck({ target: 340, tolerance: 5, samples: [335, 345] })).toEqual([]);
  });
  it("flags a batch temperature outside tolerance", () => {
    expect(flagBatchSheet({ mix_temp_c: 75, target_temp_c: 70, tolerance: 3 })).toHaveLength(1);
    expect(flagBatchSheet({ mix_temp_c: 72, target_temp_c: 70, tolerance: 3 })).toHaveLength(0);
  });
  it("flags unfinished changeover steps", () => {
    expect(flagChangeover({ "Line cleared": true, "Date code set": false })).toEqual(["Date code set: not completed"]);
  });
});

describe("predictive maintenance", () => {
  it("rates a down, overdue, critical machine as high risk", () => {
    const r = failureRisk({ hours_since_pm: 690, pm_interval_hours: 650, criticality: 5, status: "down", recent_failures: 1 });
    expect(riskLevel(r)).toBe("high");
  });
  it("rates a freshly serviced machine as low risk", () => {
    const r = failureRisk({ hours_since_pm: 50, pm_interval_hours: 500, criticality: 3, status: "running", recent_failures: 0 });
    expect(riskLevel(r)).toBe("low");
  });
  it("reports negative hours when PM is overdue", () => {
    expect(hoursToPm({ hours_since_pm: 690, pm_interval_hours: 650 })).toBe(-40);
  });
});
