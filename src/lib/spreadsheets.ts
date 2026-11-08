export type SheetData = { name: string; rows: string[][] };
export type SpreadsheetData = { filename: string; sheets: SheetData[] };
export async function readSpreadsheet(file: File): Promise<SpreadsheetData> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Choose an .xlsx workbook. Save older .xls files as .xlsx first.");
  if (file.size > 5_000_000) throw new Error("Workbook is too large (maximum 5 MB).");
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheets: SheetData[] = [];
  let cells = 0;
  workbook.eachSheet((sheet) => {
    const rows: string[][] = [];
    if (sheet.rowCount > 5000 || sheet.columnCount > 100) throw new Error("Each sheet can contain up to 5,000 rows and 100 columns.");
    sheet.eachRow((row, number) => {
      const values: string[] = [];
      for (let i = 1; i <= sheet.columnCount; i++) {
        const cell = row.getCell(i);
        values.push(cell.value instanceof Date ? cell.value.toISOString() : cell.text);
        cells++;
      }
      while (rows.length < number - 1) rows.push([]);
      rows.push(values);
    });
    if (rows.length) sheets.push({ name: sheet.name, rows });
  });
  const data = { filename: file.name, sheets };
  if (!sheets.length) throw new Error("This workbook has no readable rows.");
  if (cells > 50_000 || JSON.stringify(data).length > 300_000) throw new Error("This workbook is too large to search completely. Split it into smaller files.");
  return data;
}
export function spreadsheetContext(data: SpreadsheetData) {
  return data.sheets.map((s) => `SHEET ${s.name}\n${s.rows.map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join("\n")}`).join("\n\n");
}