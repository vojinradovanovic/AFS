import { describe, expect, it } from "vitest";
import { homeTitle, visibleNavigation } from "./access";
describe("account views", () => {
  it("gives production managers the general overview and team management", () => {
    expect(homeTitle("production_manager")).toBe("Production overview");
    expect(visibleNavigation("production_manager")).toContain("/team");
  });
  it("gives operators their machines without manager controls", () => {
    expect(homeTitle("machine_operator")).toBe("My machines");
    expect(visibleNavigation("machine_operator")).not.toContain("/team");
    expect(visibleNavigation("machine_operator")).not.toContain("/maintenance");
  });
});