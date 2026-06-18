import type { Timestamp } from "firebase/firestore"

import type { Asset, WorkOrder } from "@/models/firestore"

export const TERMINAL_STATUSES = new Set(["closed", "cancelled"])

export function woMillis(v: Timestamp | undefined): number {
  return v && typeof v.toMillis === "function" ? v.toMillis() : 0
}

/** Most relevant date for the log: closed → completed → updated → created. */
export function woEffectiveDate(wo: WorkOrder): Timestamp | undefined {
  return wo.closedAt ?? wo.executionCompletedAt ?? wo.updatedAt ?? wo.createdAt
}

/** Local YYYY-MM-DD for comparing against <input type="date"> values. */
export function woDayKey(v: Timestamp | undefined): string {
  if (!v || typeof v.toDate !== "function") return ""
  const d = v.toDate()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export type LogFilters = {
  q: string
  from: string
  to: string
  status: "all" | "active" | "closed"
  assetId?: string
}

/** Filter + sort (newest first) the fleet maintenance log by asset, period and status. */
export function filterMaintenanceLog<T extends WorkOrder & { id: string }>(
  workOrders: T[],
  assetById: Map<string, Asset & { id: string }>,
  f: LogFilters
): T[] {
  const q = f.q.trim().toLowerCase()
  return workOrders
    .filter((wo) => {
      if (f.assetId && wo.assetId !== f.assetId) return false
      const dk = woDayKey(woEffectiveDate(wo))
      if (f.from && (!dk || dk < f.from)) return false
      if (f.to && (!dk || dk > f.to)) return false
      if (f.status === "closed" && !TERMINAL_STATUSES.has(String(wo.status))) return false
      if (f.status === "active" && TERMINAL_STATUSES.has(String(wo.status))) return false
      if (!q) return true
      const a = assetById.get(wo.assetId)
      return (
        (a?.assetCode ?? "").toLowerCase().includes(q) ||
        (a?.plateNo ?? "").toLowerCase().includes(q) ||
        (a?.assetName ?? "").toLowerCase().includes(q) ||
        (wo.externalRequestNo ?? "").toLowerCase().includes(q) ||
        wo.title.toLowerCase().includes(q)
      )
    })
    .sort((x, y) => woMillis(woEffectiveDate(y)) - woMillis(woEffectiveDate(x)))
}
