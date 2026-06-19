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

/** Break decimal hours into whole days / hours / minutes. */
export function durationParts(hours: number | undefined | null): { d: number; h: number; m: number } | null {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) return null
  const totalMin = Math.round(hours * 60)
  return { d: Math.floor(totalMin / 1440), h: Math.floor((totalMin % 1440) / 60), m: totalMin % 60 }
}

/** "1d 3h 20m" style duration from decimal hours, using the given unit labels. */
export function formatDuration(
  hours: number | undefined | null,
  units: { d: string; h: string; m: string }
): string {
  const p = durationParts(hours)
  if (!p) return "—"
  if (p.d === 0 && p.h === 0 && p.m === 0) return `0${units.m}`
  return [p.d ? `${p.d}${units.d}` : "", p.h ? `${p.h}${units.h}` : "", p.m ? `${p.m}${units.m}` : ""]
    .filter(Boolean)
    .join(" ")
}
