export type ReportColumn = {
  key: string
  label: string
}

export type ReportCellValue = string | number | boolean | null | undefined

export type ReportRow = Record<string, ReportCellValue>

export type PreparedReport = {
  title: string
  generatedAtIso: string
  columns: ReportColumn[]
  rows: ReportRow[]
}

export type CsvReadyReport = {
  filename: string
  mimeType: "text/csv;charset=utf-8;"
  content: string
}

export type SpreadsheetReadyReport = PreparedReport & {
  sheetName: string
}

export type PdfReadyReport = PreparedReport & {
  orientation: "portrait" | "landscape"
  summaryLines: string[]
}

function escapeCsv(value: ReportCellValue): string {
  if (value === null || value === undefined) return ""
  const raw = String(value)
  if (!/[",\n\r]/.test(raw)) return raw
  return `"${raw.replaceAll("\"", "\"\"")}"`
}

export function prepareReport(input: {
  title: string
  columns: ReportColumn[]
  rows: ReportRow[]
  generatedAt?: Date
}): PreparedReport {
  return {
    title: input.title,
    generatedAtIso: (input.generatedAt ?? new Date()).toISOString(),
    columns: input.columns,
    rows: input.rows,
  }
}

export function toCsvReadyReport(report: PreparedReport, filename: string): CsvReadyReport {
  const header = report.columns.map((column) => escapeCsv(column.label)).join(",")
  const rows = report.rows.map((row) =>
    report.columns.map((column) => escapeCsv(row[column.key])).join(",")
  )
  return {
    filename,
    mimeType: "text/csv;charset=utf-8;",
    content: [header, ...rows].join("\n"),
  }
}

export function toExcelReadyReport(report: PreparedReport, sheetName = "SPMS Report"): SpreadsheetReadyReport {
  return {
    ...report,
    sheetName,
  }
}

export function toPdfReadyReport(
  report: PreparedReport,
  summaryLines: string[] = []
): PdfReadyReport {
  return {
    ...report,
    orientation: report.columns.length > 6 ? "landscape" : "portrait",
    summaryLines,
  }
}
