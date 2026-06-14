import * as XLSX from "xlsx"

/**
 * Read the first worksheet of an Excel/CSV file into an array of row objects
 * (keyed by the header row). Empty cells become "" so column shape is stable.
 */
export async function readSheetRows(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const sheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
}

/** Compact TSV-ish text representation of the rows, suitable as AI input. */
export function rowsToText(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const lines = [headers.join("\t")]
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] ?? "")).join("\t"))
  }
  return lines.join("\n")
}
