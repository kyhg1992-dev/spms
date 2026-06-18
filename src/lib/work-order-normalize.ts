import { Timestamp, type DocumentData } from "firebase/firestore"

import type {
  LegacyWorkOrderStatusForRead,
  WorkOrder,
  WorkOrderDelegationEntry,
  WorkOrderDelegationStatus,
  WorkOrderExecutionChecklistItem,
  WorkOrderExecutionMeterReading,
  WorkOrderLifecycleStatus,
  WorkOrderReassignmentEntry,
} from "@/models/firestore"

const CANONICAL = new Set([
  "open",
  "assigned",
  "in_progress",
  "waiting_parts",
  "waiting_approval",
  "completed",
  "closed",
  "cancelled",
])

const LIFECYCLE = new Set([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "WAITING_APPROVAL",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
])

function normalizeStatus(v: unknown): LegacyWorkOrderStatusForRead {
  if (typeof v !== "string") return "open"
  if (CANONICAL.has(v)) return v as LegacyWorkOrderStatusForRead
  if (v === "on_hold") return "waiting_parts"
  return "open"
}

function lifecycleFromStatus(status: LegacyWorkOrderStatusForRead): WorkOrderLifecycleStatus {
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

function normalizeLifecycleStatus(v: unknown, status: LegacyWorkOrderStatusForRead): WorkOrderLifecycleStatus {
  if (typeof v === "string" && LIFECYCLE.has(v)) return v as WorkOrderLifecycleStatus
  return lifecycleFromStatus(status)
}

function asTimestamp(v: unknown): Timestamp | undefined {
  return v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp) : undefined
}

function normalizeReassignmentHistory(v: unknown): WorkOrderReassignmentEntry[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((entry): WorkOrderReassignmentEntry | null => {
      const row = entry as Record<string, unknown>
      const reassignedAt = asTimestamp(row.reassignedAt)
      if (
        typeof row.assignedTo !== "string" ||
        typeof row.assignedBy !== "string" ||
        typeof row.reassignmentReason !== "string" ||
        !reassignedAt
      ) {
        return null
      }
      const normalized: WorkOrderReassignmentEntry = {
        assignedTo: row.assignedTo,
        assignedBy: row.assignedBy,
        reassignedAt,
        reassignmentReason: row.reassignmentReason,
      }
      if (typeof row.previousAssignedTo === "string") {
        normalized.previousAssignedTo = row.previousAssignedTo
      }
      return normalized
    })
    .filter((row): row is WorkOrderReassignmentEntry => row !== null)
}

function normalizeDelegationStatus(v: unknown): WorkOrderDelegationStatus | undefined {
  if (typeof v === "string" && ["ACTIVE", "EXPIRED", "CANCELLED"].includes(v)) {
    return v as WorkOrderDelegationStatus
  }
  return undefined
}

function normalizeDelegationHistory(v: unknown): WorkOrderDelegationEntry[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((entry): WorkOrderDelegationEntry | null => {
      const row = entry as Record<string, unknown>
      const delegatedAt = asTimestamp(row.delegatedAt)
      const delegationStatus = normalizeDelegationStatus(row.delegationStatus)
      if (
        typeof row.delegatedFrom !== "string" ||
        typeof row.delegatedTo !== "string" ||
        typeof row.delegatedBy !== "string" ||
        typeof row.delegationReason !== "string" ||
        !delegatedAt ||
        !delegationStatus
      ) {
        return null
      }
      const normalized: WorkOrderDelegationEntry = {
        delegatedFrom: row.delegatedFrom,
        delegatedTo: row.delegatedTo,
        delegatedBy: row.delegatedBy,
        delegatedAt,
        delegationReason: row.delegationReason,
        delegationStatus,
      }
      const delegationExpiresAt = asTimestamp(row.delegationExpiresAt)
      const acceptedAt = asTimestamp(row.acceptedAt)
      if (delegationExpiresAt) normalized.delegationExpiresAt = delegationExpiresAt
      if (acceptedAt) normalized.acceptedAt = acceptedAt
      return normalized
    })
    .filter((row): row is WorkOrderDelegationEntry => row !== null)
}

function normalizeExecutionChecklist(v: unknown): WorkOrderExecutionChecklistItem[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((entry): WorkOrderExecutionChecklistItem | null => {
      const row = entry as Record<string, unknown>
      if (typeof row.id !== "string" || typeof row.labelAr !== "string") return null
      const normalized: WorkOrderExecutionChecklistItem = {
        id: row.id,
        labelAr: row.labelAr,
        isDone: typeof row.isDone === "boolean" ? row.isDone : false,
      }
      const checkedAt = asTimestamp(row.checkedAt)
      if (typeof row.labelEn === "string") normalized.labelEn = row.labelEn
      if (checkedAt) normalized.checkedAt = checkedAt
      if (typeof row.note === "string") normalized.note = row.note
      return normalized
    })
    .filter((row): row is WorkOrderExecutionChecklistItem => row !== null)
}

function normalizeExecutionMeterReading(v: unknown): WorkOrderExecutionMeterReading | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined
  const row = v as Record<string, unknown>
  if (
    typeof row.kind !== "string" ||
    !["operating_hours", "odometer"].includes(row.kind) ||
    typeof row.value !== "number"
  ) {
    return undefined
  }
  return {
    kind: row.kind as WorkOrderExecutionMeterReading["kind"],
    value: row.value,
    readingId: typeof row.readingId === "string" ? row.readingId : undefined,
    capturedAt: asTimestamp(row.capturedAt),
  }
}

export function normalizeWorkOrder(docId: string, data: DocumentData): WorkOrder & { id: string } {
  const d = data as Record<string, unknown>
  const createdAt =
    d.createdAt && typeof (d.createdAt as Timestamp).toMillis === "function"
      ? (d.createdAt as Timestamp)
      : Timestamp.now()
  const updatedAt =
    d.updatedAt && typeof (d.updatedAt as Timestamp).toMillis === "function"
      ? (d.updatedAt as Timestamp)
      : Timestamp.now()

  const status = normalizeStatus(d.status)
  return {
    id: docId,
    createdAt,
    updatedAt,
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : "",
    assetId: typeof d.assetId === "string" ? d.assetId : "",
    requesterId: typeof d.requesterId === "string" ? d.requesterId : "",
    assigneeId: typeof d.assigneeId === "string" ? d.assigneeId : undefined,
    assignedTo: typeof d.assignedTo === "string" ? d.assignedTo : typeof d.assigneeId === "string" ? d.assigneeId : undefined,
    assignedBy: typeof d.assignedBy === "string" ? d.assignedBy : undefined,
    reassignedAt: asTimestamp(d.reassignedAt),
    reassignmentReason: typeof d.reassignmentReason === "string" ? d.reassignmentReason : undefined,
    reassignmentHistory: normalizeReassignmentHistory(d.reassignmentHistory),
    delegatedFrom: typeof d.delegatedFrom === "string" ? d.delegatedFrom : undefined,
    delegatedTo: typeof d.delegatedTo === "string" ? d.delegatedTo : undefined,
    delegatedBy: typeof d.delegatedBy === "string" ? d.delegatedBy : undefined,
    delegatedAt: asTimestamp(d.delegatedAt),
    delegationReason: typeof d.delegationReason === "string" ? d.delegationReason : undefined,
    delegationExpiresAt: asTimestamp(d.delegationExpiresAt),
    delegationStatus: normalizeDelegationStatus(d.delegationStatus),
    delegationHistory: normalizeDelegationHistory(d.delegationHistory),
    status,
    lifecycleStatus: normalizeLifecycleStatus(d.lifecycleStatus, status),
    priority:
      typeof d.priority === "string" && ["low", "medium", "high", "critical"].includes(d.priority)
        ? (d.priority as WorkOrder["priority"])
        : "medium",
    dueDate:
      d.dueDate && typeof (d.dueDate as Timestamp).toMillis === "function"
        ? (d.dueDate as Timestamp)
        : undefined,
    closedAt:
      d.closedAt && typeof (d.closedAt as Timestamp).toMillis === "function"
        ? (d.closedAt as Timestamp)
        : undefined,
    closedByUid: typeof d.closedByUid === "string" ? d.closedByUid : undefined,
    executionStartedAt: asTimestamp(d.executionStartedAt),
    executionCompletedAt: asTimestamp(d.executionCompletedAt),
    technicianNotes: typeof d.technicianNotes === "string" ? d.technicianNotes : undefined,
    laborHours: typeof d.laborHours === "number" ? d.laborHours : undefined,
    downtimeMinutes: typeof d.downtimeMinutes === "number" ? d.downtimeMinutes : undefined,
    downtimeHours: typeof d.downtimeHours === "number" ? d.downtimeHours : undefined,
    completionNotes: typeof d.completionNotes === "string" ? d.completionNotes : undefined,
    actualLaborHours: typeof d.actualLaborHours === "number" ? d.actualLaborHours : undefined,
    actualDowntimeHours: typeof d.actualDowntimeHours === "number" ? d.actualDowntimeHours : undefined,
    meterReadingAtExecution: normalizeExecutionMeterReading(d.meterReadingAtExecution),
    executionChecklist: normalizeExecutionChecklist(d.executionChecklist),
    executionPhotos: Array.isArray(d.executionPhotos)
      ? d.executionPhotos.filter((item): item is string => typeof item === "string")
      : undefined,
    requiredPartsNote: typeof d.requiredPartsNote === "string" ? d.requiredPartsNote : undefined,
    safetyNotes: typeof d.safetyNotes === "string" ? d.safetyNotes : undefined,
    completionMeterReadingId: typeof d.completionMeterReadingId === "string" ? d.completionMeterReadingId : undefined,
    attachmentsPlaceholder: Array.isArray(d.attachmentsPlaceholder)
      ? d.attachmentsPlaceholder.filter((item): item is string => typeof item === "string")
      : undefined,
    internalNotes: typeof d.internalNotes === "string" ? d.internalNotes : undefined,
    estimatedCost: typeof d.estimatedCost === "number" ? d.estimatedCost : undefined,
    actualCost: typeof d.actualCost === "number" ? d.actualCost : undefined,
    approvalRequired:
      typeof d.approvalRequired === "boolean" ? d.approvalRequired : undefined,
    approvedByUid: typeof d.approvedByUid === "string" ? d.approvedByUid : undefined,
    approvedAt:
      d.approvedAt && typeof (d.approvedAt as Timestamp).toMillis === "function"
        ? (d.approvedAt as Timestamp)
        : undefined,
    rejectedAt: asTimestamp(d.rejectedAt),
    rejectedByUid: typeof d.rejectedByUid === "string" ? d.rejectedByUid : undefined,
    rejectionReason: typeof d.rejectionReason === "string" ? d.rejectionReason : undefined,
    pmScheduleId: typeof d.pmScheduleId === "string" ? d.pmScheduleId : undefined,
    sourceType:
      typeof d.sourceType === "string" && ["PM", "MANUAL", "REQUEST"].includes(d.sourceType)
        ? (d.sourceType as WorkOrder["sourceType"])
        : undefined,
    sourceRef: typeof d.sourceRef === "string" ? d.sourceRef : undefined,
    serviceLevelCode:
      typeof d.serviceLevelCode === "string" && /^[A-Z]$/.test(d.serviceLevelCode)
        ? (d.serviceLevelCode as WorkOrder["serviceLevelCode"])
        : undefined,
    serviceLevelNameAr:
      typeof d.serviceLevelNameAr === "string" ? d.serviceLevelNameAr : undefined,
    serviceLevelIndex:
      typeof d.serviceLevelIndex === "number" && Number.isInteger(d.serviceLevelIndex) && d.serviceLevelIndex >= 0
        ? d.serviceLevelIndex
        : undefined,
    rotationAdvanced: typeof d.rotationAdvanced === "boolean" ? d.rotationAdvanced : undefined,
    serviceTasks: Array.isArray(d.serviceTasks)
      ? (d.serviceTasks as WorkOrder["serviceTasks"])
      : undefined,
    lastPublicComment:
      typeof d.lastPublicComment === "string" ? d.lastPublicComment : undefined,
  }
}

export function workOrderCategoryActiveStatuses(): string[] {
  /** `on_hold` kept for persisted legacy WO rows */
  return ["open", "assigned", "in_progress", "waiting_parts", "on_hold"]
}
