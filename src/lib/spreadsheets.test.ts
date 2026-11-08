import { expect, it } from "vitest";
import { spreadsheetContext } from "./spreadsheets";
it("preserves sheet names and row numbers for Excel answers", () => {
  expect(spreadsheetContext({ filename: "production.xlsx", sheets: [{ name: "Output", rows: [["Machine", "Units"], ["Packer", "1250"]] }] })).toBe('SHEET Output\nRow 1: ["Machine","Units"]\nRow 2: ["Packer","1250"]');
});