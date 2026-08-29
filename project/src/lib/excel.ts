import ExcelJS from "exceljs";
import { Readable } from "stream";

/**
 * Shared Excel parsing helpers built on exceljs, replacing the vulnerable
 * `xlsx` (SheetJS) package. The helpers mirror the xlsx.utils.sheet_to_json
 * usage patterns previously used across the API routes:
 *
 * - sheetToMatrix(ws)            ~= sheet_to_json(sheet, { header: 1 })
 * - sheetToMatrix(ws, {defval})  ~= sheet_to_json(sheet, { header: 1, defval })
 * - sheetToJson(ws)              ~= sheet_to_json(sheet)
 * - sheetToJson(ws, {defval})    ~= sheet_to_json(sheet, { defval })
 */

export type CellPrimitive = string | number | boolean | Date | undefined;

/** Load an .xlsx/.xls workbook from a Buffer or ArrayBuffer. */
export async function parseWorkbook(
  data: Buffer | ArrayBuffer
): Promise<ExcelJS.Workbook> {
  const buf: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  return workbook;
}

/**
 * Load a CSV file into a single-sheet workbook (xlsx's XLSX.read used to
 * auto-detect CSV content; exceljs needs an explicit CSV reader).
 */
export async function parseCsvWorkbook(
  data: Buffer | ArrayBuffer
): Promise<ExcelJS.Workbook> {
  const buf: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(Readable.from(buf));
  return workbook;
}

/** First worksheet of the workbook (equivalent of Sheets[SheetNames[0]]). */
export function getFirstWorksheet(
  workbook: ExcelJS.Workbook
): ExcelJS.Worksheet | undefined {
  return workbook.worksheets[0];
}

/**
 * Normalize an exceljs cell value to a primitive, matching the "raw" values
 * that xlsx sheet_to_json produced: numbers stay numbers, dates become Date
 * objects, rich text / hyperlinks / formulas are collapsed to their
 * displayed value, and empty cells become undefined.
 */
function normalizeCellValue(value: ExcelJS.CellValue): CellPrimitive {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((rt) => rt.text).join("");
    }
    if ("error" in value) return undefined;
    if ("result" in value && value.result !== undefined) {
      // Formula cell: use the cached result
      return normalizeCellValue(value.result as ExcelJS.CellValue);
    }
    if ("hyperlink" in value) {
      const text = (value as ExcelJS.CellHyperlinkValue).text as unknown;
      if (typeof text === "string") return text;
      if (
        text &&
        typeof text === "object" &&
        "richText" in (text as Record<string, unknown>)
      ) {
        const rich = (text as { richText: { text: string }[] }).richText;
        return rich.map((rt) => rt.text).join("");
      }
      return (value as ExcelJS.CellHyperlinkValue).hyperlink;
    }
    if ("formula" in value) return undefined; // formula without cached result
    return String(value);
  }
  return value as CellPrimitive;
}

export interface SheetOptions {
  /** Value used for empty cells (like xlsx `defval`). Omit to leave them undefined. */
  defval?: unknown;
}

/**
 * Convert a worksheet to an array of row arrays (xlsx `{ header: 1 }`).
 * Row/column positions are preserved (blank rows appear as rows of empty
 * cells), merged cells resolve to the master cell's value, and every row has
 * uniform width equal to the sheet's column count.
 */
export function sheetToMatrix(
  worksheet: ExcelJS.Worksheet,
  opts: SheetOptions = {}
): unknown[][] {
  const hasDefval = Object.prototype.hasOwnProperty.call(opts, "defval");
  const rowCount = worksheet.rowCount;
  const colCount = worksheet.columnCount;
  const matrix: unknown[][] = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const cells: unknown[] = [];
    for (let c = 1; c <= colCount; c++) {
      const v = normalizeCellValue(row.getCell(c).value);
      cells.push(v === undefined && hasDefval ? opts.defval : v);
    }
    matrix.push(cells);
  }
  return matrix;
}

/**
 * Convert a worksheet to an array of objects keyed by the first (header)
 * row, mirroring xlsx sheet_to_json default behavior: header cells are
 * stringified, fully blank rows are skipped, and empty cells are either
 * omitted or filled with `defval` when provided.
 */
export function sheetToJson<T = Record<string, unknown>>(
  worksheet: ExcelJS.Worksheet,
  opts: SheetOptions = {}
): T[] {
  const hasDefval = Object.prototype.hasOwnProperty.call(opts, "defval");
  const matrix = sheetToMatrix(worksheet);
  if (matrix.length === 0) return [];

  const headers = matrix[0].map((h) =>
    h === undefined || h === null ? "" : String(h).trim()
  );

  const out: T[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const isBlank = row.every(
      (v) => v === undefined || v === null || v === ""
    );
    if (isBlank) continue;

    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const v = row[c];
      if (v === undefined) {
        if (hasDefval) obj[key] = opts.defval;
        continue;
      }
      obj[key] = v;
    }
    out.push(obj as T);
  }
  return out;
}
