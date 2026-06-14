import type { Timestamp } from "firebase/firestore"

export function formatArDate(ts: Timestamp | undefined | null): string {
  if (!ts || typeof ts.toDate !== "function") return "—"
  return ts.toDate().toLocaleDateString("ar-SA", { dateStyle: "medium" })
}

export function formatArDateTime(ts: Timestamp | undefined | null): string {
  if (!ts || typeof ts.toDate !== "function") return "—"
  return ts.toDate().toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
