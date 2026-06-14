import type { Timestamp } from "firebase/firestore"

import { workOrderCategoryActiveStatuses } from "@/lib/work-order-normalize"
import type { Asset, PMSchedule, SpmsUser, WorkOrder } from "@/models/firestore"

export type MaintenanceKPIInput = {
  assets: Array<Asset & { id: string }>
  workOrders: Array<WorkOrder & { id: string }>
  pmSchedules: Array<PMSchedule & { id: string }>
  users?: Array<SpmsUser & { id: string }>
  nowMs?: number
}

export type TechnicianWorkloadRow = {
  technicianUid: string
  displayName?: string
  activeWorkOrders: number
  inProgressWorkOrders: number
  waitingApprovalWorkOrders: number
  completedWorkOrders: number
}

export type MaintenanceKPIBundle = {
  pmCompliancePct: number | null
  mtbfHours: number | null
  mttrHours: number | null
  downtimeHours: number
  workOrderCompletionRatePct: number | null
  overduePmCount: number
  overdueWorkOrderCount: number
  technicianWorkload: TechnicianWorkloadRow[]
  assetAvailabilityPct: number | null
}

const HOUR_MS = 60 * 60 * 1000
const completedStatuses = new Set<string>(["completed", "closed"])
const activeStatuses = new Set<string>(workOrderCategoryActiveStatuses())

function millis(ts: Timestamp | undefined): number {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function isOverduePm(schedule: PMSchedule, nowMs: number): boolean {
  if (!schedule.isActive) return false
  if (schedule.overdueStatus) return true
  return typeof schedule.nextRunAt?.toMillis === "function" && schedule.nextRunAt.toMillis() < nowMs
}

function isOverdueWorkOrder(workOrder: WorkOrder, nowMs: number): boolean {
  if (!activeStatuses.has(String(workOrder.status))) return false
  return typeof workOrder.dueDate?.toMillis === "function" && workOrder.dueDate.toMillis() < nowMs
}

function repairDurationHours(workOrder: WorkOrder): number | null {
  const start = millis(workOrder.executionStartedAt) || millis(workOrder.createdAt)
  const end = millis(workOrder.executionCompletedAt) || millis(workOrder.closedAt) || millis(workOrder.updatedAt)
  if (!start || !end || end <= start) return null
  return (end - start) / HOUR_MS
}

export function calculatePMCompliancePct(pmSchedules: PMSchedule[], nowMs = Date.now()): number | null {
  const active = pmSchedules.filter((schedule) => schedule.isActive)
  const compliant = active.filter((schedule) => !isOverduePm(schedule, nowMs))
  return pct(compliant.length, active.length)
}

export function calculateMTTRHours(workOrders: WorkOrder[]): number | null {
  const samples = workOrders
    .filter((workOrder) => completedStatuses.has(String(workOrder.status)))
    .map(repairDurationHours)
    .filter((value): value is number => typeof value === "number" && value > 0)
  if (samples.length === 0) return null
  return samples.reduce((sum, value) => sum + value, 0) / samples.length
}

export function calculateMTBFHours(input: {
  assets: Asset[]
  workOrders: WorkOrder[]
}): number | null {
  const totalOperatingHours = input.assets.reduce((sum, asset) => sum + (asset.operatingHours || 0), 0)
  const incidents = input.workOrders.filter((workOrder) => completedStatuses.has(String(workOrder.status))).length
  if (totalOperatingHours <= 0 || incidents <= 0) return null
  return totalOperatingHours / incidents
}

export function calculateDowntimeHours(workOrders: WorkOrder[]): number {
  return workOrders.reduce((sum, workOrder) => {
    if (typeof workOrder.actualDowntimeHours === "number") return sum + workOrder.actualDowntimeHours
    if (typeof workOrder.downtimeHours === "number") return sum + workOrder.downtimeHours
    if (typeof workOrder.downtimeMinutes === "number") return sum + workOrder.downtimeMinutes / 60
    return sum
  }, 0)
}

export function calculateWorkOrderCompletionRatePct(workOrders: WorkOrder[]): number | null {
  const relevant = workOrders.filter((workOrder) => String(workOrder.status) !== "cancelled")
  const completed = relevant.filter((workOrder) => completedStatuses.has(String(workOrder.status)))
  return pct(completed.length, relevant.length)
}

export function calculateAssetAvailabilityPct(assets: Asset[]): number | null {
  const fleet = assets.filter((asset) => asset.status !== "retired")
  const available = fleet.filter((asset) => asset.status === "active")
  return pct(available.length, fleet.length)
}

export function calculateTechnicianWorkload(input: {
  workOrders: Array<WorkOrder & { id: string }>
  users?: Array<SpmsUser & { id: string }>
}): TechnicianWorkloadRow[] {
  const userNames = new Map((input.users ?? []).map((user) => [user.id, user.displayName]))
  const rows = new Map<string, TechnicianWorkloadRow>()

  for (const workOrder of input.workOrders) {
    const technicianUid = workOrder.assignedTo ?? workOrder.assigneeId
    if (!technicianUid) continue
    const row =
      rows.get(technicianUid) ??
      {
        technicianUid,
        displayName: userNames.get(technicianUid),
        activeWorkOrders: 0,
        inProgressWorkOrders: 0,
        waitingApprovalWorkOrders: 0,
        completedWorkOrders: 0,
      }

    if (activeStatuses.has(String(workOrder.status))) row.activeWorkOrders += 1
    if (workOrder.status === "in_progress") row.inProgressWorkOrders += 1
    if (workOrder.status === "waiting_approval") row.waitingApprovalWorkOrders += 1
    if (completedStatuses.has(String(workOrder.status))) row.completedWorkOrders += 1
    rows.set(technicianUid, row)
  }

  return [...rows.values()].sort((a, b) => b.activeWorkOrders - a.activeWorkOrders)
}

export function calculateMaintenanceKpis(input: MaintenanceKPIInput): MaintenanceKPIBundle {
  const nowMs = input.nowMs ?? Date.now()
  return {
    pmCompliancePct: calculatePMCompliancePct(input.pmSchedules, nowMs),
    mtbfHours: calculateMTBFHours({ assets: input.assets, workOrders: input.workOrders }),
    mttrHours: calculateMTTRHours(input.workOrders),
    downtimeHours: calculateDowntimeHours(input.workOrders),
    workOrderCompletionRatePct: calculateWorkOrderCompletionRatePct(input.workOrders),
    overduePmCount: input.pmSchedules.filter((schedule) => isOverduePm(schedule, nowMs)).length,
    overdueWorkOrderCount: input.workOrders.filter((workOrder) => isOverdueWorkOrder(workOrder, nowMs)).length,
    technicianWorkload: calculateTechnicianWorkload({
      workOrders: input.workOrders,
      users: input.users,
    }),
    assetAvailabilityPct: calculateAssetAvailabilityPct(input.assets),
  }
}
