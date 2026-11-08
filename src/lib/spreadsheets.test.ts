import { expect, it } from "vitest";
import { detectHeaderRow, spreadsheetContext } from "./spreadsheets";
it("preserves sheet names and row numbers for Excel answers", () => {
  expect(spreadsheetContext({ filename: "production.xlsx", sheets: [{ name: "Output", rows: [["Machine", "Units"], ["Packer", "1250"]] }] })).toBe('SHEET Output\nRow 1: ["Machine","Units"]\nRow 2: ["Packer","1250"]');
});
it("finds a title row after leading empty rows without changing source row numbers", () => {
  const sheet = { name: "Downtime", rows: [[], ["Product Code", "Planned Vol (kg)", "Downtime Comments"], ["52065500", "20000", "Blockage"]] };
  expect(detectHeaderRow(sheet)).toBe(1);
  expect(sheet.rows[2]).toEqual(["52065500", "20000", "Blockage"]);
});
it("does not treat numeric data as a title row", () => {
  expect(detectHeaderRow({ name: "Readings", rows: [["100", "200"], ["110", "220"]] })).toBeNull();
});