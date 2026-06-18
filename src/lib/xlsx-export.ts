import * as XLSX from "xlsx"

/**
 * Export an array of flat objects to a downloaded .xlsx file. Keys become the
 * header row (RTL-friendly Arabic headers are fine). Sheet names are capped at the
 * Excel 31-char limit.
 */
export function exportRowsToExcel(
  filename: string,
  rows: Record<string, string | number>[],
  sheetName = "Sheet1"
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`)
}

/** Short YYYY-MM-DD stamp for filenames, from a real Date (browser only). */
export function fileDateStamp(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}
