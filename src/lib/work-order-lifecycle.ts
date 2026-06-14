import type { Timestamp } from "firebase/firestore"

import type { UserRole, WorkOrder, WorkOrderLifecycleStatus, WorkOrderStatus } from "@/models/firestore"

export const WORK_ORDER_LIFECYCLE_STATES: readonly WorkOrderLifecycleStatus[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "WAITING_APPROVAL",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
]

export type WorkOrderCompletionData = {
  completionNotes?: string
  laborHours?: number
  downtimeHours?: number
  downtimeMinutes?: number
  completionMeterReadingId?: string
  attachmentsPlaceholder?: string[]
}

export type WorkOrderTransitionInput = {
  workOrder: WorkOrder
  targetStatus: WorkOrderLifecycleStatus
  actorRole: UserRole
  completionData?: WorkOrderCompletionData
  assignedTo?: string
  approvalRequired?: boolean
}

export type WorkOrderValidationResult = {
  ok: boolean
  errors: string[]
}

const TERMINAL_STATES = new Set<WorkOrderLifecycleStatus>(["CLOSED", "CANCELLED"])

const ALLOWED_TRANSITIONS: Record<WorkOrderLifecycleStatus, readonly WorkOrderLifecycleStatus[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "WAITING_APPROVAL", "COMPLETED", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  WAITING_APPROVAL: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
}

export function workOrderLifecycleToStatus(status: WorkOrderLifecycleStatus): WorkOrderStatus {
  switch (status) {
    case "OPEN":
      return "open"
    case "ASSIGNED":
      return "assigned"
    case "IN_PROGRESS":
      return "in_progress"
    case "WAITING_PARTS":
      return "waiting_parts"
    case "WAITING_APPROVAL":
      return "waiting_approval"
    case "COMPLETED":
      return "completed"
    case "CLOSED":
      return "closed"
    case "CANCELLED":
      return "cancelled"
  }
}

export function workOrderStatusToLifecycle(status: WorkOrder["status"]): WorkOrderLifecycleStatus {
  switch (status) {
    case "assigned":
      return "ASSIGNED"
    case "in_progress":
      return "IN_PROGRESS"
    case "waiting_parts":
    case "on_hold":
      return "WAITING_PARTS"
    case "waiting_approval":
      return "WAITING_APPROVAL"
    case "completed":
      return "COMPLETED"
    case "closed":
      return "CLOSED"
    case "cancelled":
      return "CANCELLED"
    case "open":
      return "OPEN"
  }
}

export function getWorkOrderLifecycleStatus(workOrder: WorkOrder): WorkOrderLifecycleStatus {
  return workOrder.lifecycleStatus ?? workOrderStatusToLifecycle(workOrder.status)
}

function hasAssignedTechnician(workOrder: WorkOrder, assignedTo?: string): boolean {
  return !!(assignedTo?.trim() || workOrder.assignedTo?.trim() || workOrder.assigneeId?.trim())
}

function hasCompletionData(workOrder: WorkOrder, data: WorkOrderCompletionData | undefined): boolean {
  const notes = data?.completionNotes ?? workOrder.completionNotes
  const laborHours = data?.laborHours ?? workOrder.laborHours
  return !!notes?.trim() && typeof laborHours === "number" && laborHours >= 0
}

function hasDowntimeData(workOrder: WorkOrder, data: WorkOrderCompletionData | undefined): boolean {
  const downtimeHours = data?.downtimeHours ?? workOrder.downtimeHours
  const downtimeMinutes = data?.downtimeMinutes ?? workOrder.downtimeMinutes
  if (typeof downtimeHours === "number" && downtimeHours >= 0) return true
  return typeof downtimeMinutes === "number" && downtimeMinutes >= 0
}

function canApprove(role: UserRole): boolean {
  return role === "admin" || role === "manager"
}

export function validateWorkOrderTransition(input: WorkOrderTransitionInput): WorkOrderValidationResult {
  const current = getWorkOrderLifecycleStatus(input.workOrder)
  const errors: string[] = []

  if (current === input.targetStatus) {
    return { ok: true, errors: [] }
  }

  if (TERMINAL_STATES.has(current)) {
    errors.push(`${current} work orders cannot transition to ${input.targetStatus}.`)
  }

  if (!ALLOWED_TRANSITIONS[current].includes(input.targetStatus)) {
    errors.push(`Transition ${current} -> ${input.targetStatus} is not allowed.`)
  }

  if (
    (input.targetStatus === "ASSIGNED" || input.targetStatus === "IN_PROGRESS") &&
    !hasAssignedTechnician(input.workOrder, input.assignedTo)
  ) {
    errors.push(`${input.targetStatus} requires an assigned technician.`)
  }

  if (input.targetStatus === "WAITING_APPROVAL" && !input.workOrder.approvalRequired && !input.approvalRequired) {
    errors.push("WAITING_APPROVAL requires approvalRequired=true.")
  }

  if (input.targetStatus === "COMPLETED") {
    if (!hasCompletionData(input.workOrder, input.completionData)) {
      errors.push("COMPLETED requires completion notes and non-negative labor hours.")
    }
    if (!hasDowntimeData(input.workOrder, input.completionData)) {
      errors.push("COMPLETED requires downtime hours or downtime minutes.")
    }
    if (input.workOrder.approvalRequired && !input.workOrder.approvedAt && !canApprove(input.actorRole)) {
      errors.push("COMPLETED requires approval before technician completion.")
    }
  }

  if (input.targetStatus === "CLOSED" && current !== "COMPLETED") {
    errors.push("CLOSED requires the work order to be COMPLETED first.")
  }

  return { ok: errors.length === 0, errors }
}

export function assertWorkOrderTransition(input: WorkOrderTransitionInput): void {
  const result = validateWorkOrderTransition(input)
  if (!result.ok) throw new Error(result.errors.join(" "))
}

export function validateReassignment(input: {
  assignedTo: string
  assignedBy: string
  reassignmentReason: string
}): WorkOrderValidationResult {
  const errors: string[] = []
  if (!input.assignedTo.trim()) errors.push("assignedTo is required.")
  if (!input.assignedBy.trim()) errors.push("assignedBy is required.")
  if (!input.reassignmentReason.trim()) errors.push("reassignmentReason is required.")
  return { ok: errors.length === 0, errors }
}

export function createReassignmentEntry(input: {
  assignedTo: string
  assignedBy: string
  reassignmentReason: string
  reassignedAt: Timestamp
  previousAssignedTo?: string
}) {
  return {
    assignedTo: input.assignedTo,
    assignedBy: input.assignedBy,
    reassignedAt: input.reassignedAt,
    reassignmentReason: input.reassignmentReason,
    previousAssignedTo: input.previousAssignedTo,
  }
}
