import type { Asset, PMSchedule, SpmsUser, WorkOrder } from "@/models/firestore"
import { calculateTechnicianWorkload, type TechnicianWorkloadRow } from "@/lib/kpi-engine"
import { workOrderCategoryActiveStatuses } from "@/lib/work-order-normalize"

export type OperationalSummary = {
  activeWorkOrders: number
  overduePMs: number
  criticalAssets: number
  workOrdersWaitingApproval: number
  technicianExecutionStatus: TechnicianWorkloadRow[]
  upcomingPM: Array<PMSchedule & { id: string }>
}

const activeStatuses = new Set<string>(workOrderCategoryActiveStatuses())

function isOverduePm(schedule: PMSchedule, nowMs: number): boolean {
  if (!schedule.isActive) return false
  if (schedule.overdueStatus) return true
  return schedule.nextRunAt?.toMillis?.() ? schedule.nextRunAt.toMillis() < nowMs : false
}

export function buildOperationalSummary(input: {
  assets: Array<Asset & { id: string }>
  workOrders: Array<WorkOrder & { id: string }>
  pmSchedules: Array<PMSchedule & { id: string }>
  users?: Array<SpmsUser & { id: string }>
  nowMs?: number
  upcomingLimit?: number
}): OperationalSummary {
  const nowMs = input.nowMs ?? Date.now()
  const upcomingLimit = input.upcomingLimit ?? 5

  return {
    activeWorkOrders: input.workOrders.filter((workOrder) => activeStatuses.has(String(workOrder.status))).length,
    overduePMs: input.pmSchedules.filter((schedule) => isOverduePm(schedule, nowMs)).length,
    criticalAssets: input.assets.filter((asset) => asset.status === "maintenance").length,
    workOrdersWaitingApproval: input.workOrders.filter((workOrder) => workOrder.status === "waiting_approval").length,
    technicianExecutionStatus: calculateTechnicianWorkload({
      workOrders: input.workOrders,
      users: input.users,
    }),
    upcomingPM: input.pmSchedules
      .filter((schedule) => schedule.isActive)
      .sort((a, b) => a.nextRunAt.toMillis() - b.nextRunAt.toMillis())
      .slice(0, upcomingLimit),
  }
}
