import type { Timestamp } from "firebase/firestore"

import { calculateMaintenanceKpis } from "@/lib/kpi-engine"
import { buildOperationalSummary } from "@/lib/operational-summary"
import type { Asset, PMSchedule, WorkOrder } from "@/models/firestore"

export type KPIBundle = {
  activeWorkOrders: number
  delayedPm: number
  assetFleetSize: number
  assetsUnderCare: number
  mtbfHours: number | null
  mttrHours: number | null
  availabilityPct: number | null
  maintenanceCostRolling: number
  unreadAlerts: number
}

function millis(ts: Timestamp | undefined): number {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0
}

/**
 * Lightweight enterprise KPI derivation from WO/PM/asset snapshots (not full historian).
 */
export function computeDashboardKpis(input: {
  assets: Array<Asset & { id: string }>
  workOrders: Array<WorkOrder & { id: string }>
  pm: Array<PMSchedule & { id: string }>
  unreadNotifications: number
  comparisonNowMs: number
}): KPIBundle {
  const { assets, workOrders: wos, pm, unreadNotifications, comparisonNowMs: now } = input

  const kpi = calculateMaintenanceKpis({ assets, workOrders: wos, pmSchedules: pm, nowMs: now })
  const summary = buildOperationalSummary({ assets, workOrders: wos, pmSchedules: pm, nowMs: now })

  const fleet = assets.filter((a) => a.status !== "retired").length
  const underCare = assets.filter((a) => a.status === "maintenance").length

  const completed = wos.filter((w) => w.status === "completed")

  /** MTTR: avg repair interval for completed WO (closedAt-createdAt fallback). */
  const mttrSamples = completed
    .map((w) => {
      const start = millis(w.createdAt)
      const end = millis(w.closedAt) || millis(w.updatedAt)
      if (!start || !end || end <= start) return null
      return (end - start) / (1000 * 60 * 60)
    })
    .filter((v): v is number => v !== null && v > 0)
  const mttrHours =
    mttrSamples.length > 0
      ? mttrSamples.reduce((a, b) => a + b, 0) / mttrSamples.length
      : null

  /** MTBF heuristic: cumulative operating-hours / incidents (completed WO on active fleet). */
  const totalOperating = assets.reduce((s, a) => s + (a.operatingHours || 0), 0)
  const incidents = Math.max(1, completed.length)
  const mtbfHours = totalOperating > 0 ? totalOperating / incidents : null

  /** Availability proxy — assets not in downtime / fleet. */
  const availabilityPct = fleet ? Math.round(((fleet - underCare) / fleet) * 1000) / 10 : null

  const maintenanceCostRolling = completed.reduce((s, w) => s + (w.actualCost ?? w.estimatedCost ?? 0), 0)

  return {
    activeWorkOrders: summary.activeWorkOrders,
    delayedPm: kpi.overduePmCount,
    assetFleetSize: fleet,
    assetsUnderCare: underCare,
    mtbfHours: kpi.mtbfHours ?? mtbfHours,
    mttrHours: kpi.mttrHours ?? mttrHours,
    availabilityPct: kpi.assetAvailabilityPct ?? availabilityPct,
    maintenanceCostRolling,
    unreadAlerts: unreadNotifications,
  }
}
