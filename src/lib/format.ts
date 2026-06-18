import type { Timestamp } from "firebase/firestore"

// Dates and numbers are rendered with Latin (English) digits and the Gregorian
// calendar across the app, per requirement — using a fixed "en-GB" locale so the
// output never depends on the viewer's browser locale.
const DATE_LOCALE = "en-GB"

export function formatArDate(ts: Timestamp | undefined | null): string {
  if (!ts || typeof ts.toDate !== "function") return "—"
  return ts.toDate().toLocaleDateString(DATE_LOCALE, { dateStyle: "medium" })
}

export function formatArDateTime(ts: Timestamp | undefined | null): string {
  if (!ts || typeof ts.toDate !== "function") return "—"
  return ts.toDate().toLocaleString(DATE_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  })
}

/** Format a number with Latin digits and thousands separators (e.g. 12,345). */
export function formatNum(value: number | undefined | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US")
}
