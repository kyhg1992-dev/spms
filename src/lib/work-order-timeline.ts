import type { ActivityLogEntry, WorkOrder, WorkOrderLifecycleStatus } from "@/models/firestore"
import { getWorkOrderLifecycleStatus } from "@/lib/work-order-lifecycle"

export type WorkOrderTimelineEntryKind =
  | "created"
  | "updated"
  | "status"
  | "reassignment"
  | "delegation"
  | "execution"
  | "approval"
  | "closure"
  | "audit"

export type WorkOrderTimelineEntry = {
  id: string
  kind: WorkOrderTimelineEntryKind
  titleAr: string
  titleEn: string
  description?: string
  occurredAt?: WorkOrder["createdAt"]
}

function timestampMs(value: WorkOrderTimelineEntry["occurredAt"]): number {
  return value?.toMillis?.() ?? 0
}

function statusLabel(status: WorkOrderLifecycleStatus): string {
  return status.replaceAll("_", " ")
}

function pushIfDate(
  entries: WorkOrderTimelineEntry[],
  entry: WorkOrderTimelineEntry
): void {
  if (entry.occurredAt) entries.push(entry)
}

export function buildWorkOrderTimeline(input: {
  workOrder: WorkOrder & { id: string }
  auditLogs?: Array<ActivityLogEntry & { id: string }>
}): WorkOrderTimelineEntry[] {
  const { workOrder } = input
  const entries: WorkOrderTimelineEntry[] = []

  pushIfDate(entries, {
    id: `${workOrder.id}-created`,
    kind: "created",
    titleAr: "إنشاء أمر العمل",
    titleEn: "Work order created",
    occurredAt: workOrder.createdAt,
  })

  entries.push({
    id: `${workOrder.id}-status-current`,
    kind: "status",
    titleAr: `الحالة الحالية: ${statusLabel(getWorkOrderLifecycleStatus(workOrder))}`,
    titleEn: `Current status: ${statusLabel(getWorkOrderLifecycleStatus(workOrder))}`,
    occurredAt: workOrder.updatedAt,
  })

  for (const item of workOrder.reassignmentHistory ?? []) {
    entries.push({
      id: `${workOrder.id}-reassignment-${item.reassignedAt.toMillis()}`,
      kind: "reassignment",
      titleAr: "إعادة إسناد أمر العمل",
      titleEn: "Work order reassigned",
      description: item.reassignmentReason,
      occurredAt: item.reassignedAt,
    })
  }

  for (const item of workOrder.delegationHistory ?? []) {
    entries.push({
      id: `${workOrder.id}-delegation-${item.delegatedAt.toMillis()}`,
      kind: "delegation",
      titleAr: `تفويض مهمة: ${item.delegationStatus}`,
      titleEn: `Delegation: ${item.delegationStatus}`,
      description: item.delegationReason,
      occurredAt: item.acceptedAt ?? item.delegatedAt,
    })
  }

  pushIfDate(entries, {
    id: `${workOrder.id}-execution-started`,
    kind: "execution",
    titleAr: "بدء تنفيذ الفني",
    titleEn: "Technician execution started",
    occurredAt: workOrder.executionStartedAt,
  })

  pushIfDate(entries, {
    id: `${workOrder.id}-execution-completed`,
    kind: "execution",
    titleAr: "اكتمال تنفيذ الفني",
    titleEn: "Technician execution completed",
    description: workOrder.completionNotes,
    occurredAt: workOrder.executionCompletedAt,
  })

  pushIfDate(entries, {
    id: `${workOrder.id}-approved`,
    kind: "approval",
    titleAr: "اعتماد أمر العمل",
    titleEn: "Work order approved",
    occurredAt: workOrder.approvedAt,
  })

  pushIfDate(entries, {
    id: `${workOrder.id}-rejected`,
    kind: "approval",
    titleAr: "رفض أمر العمل",
    titleEn: "Work order rejected",
    description: workOrder.rejectionReason,
    occurredAt: workOrder.rejectedAt,
  })

  pushIfDate(entries, {
    id: `${workOrder.id}-closed`,
    kind: "closure",
    titleAr: "إغلاق أمر العمل",
    titleEn: "Work order closed",
    occurredAt: workOrder.closedAt,
  })

  for (const log of input.auditLogs ?? []) {
    if (log.entityType !== "work_order" || log.entityId !== workOrder.id) continue
    entries.push({
      id: `audit-${log.id}`,
      kind: "audit",
      titleAr: log.labelAr,
      titleEn: log.actionKey,
      occurredAt: log.createdAt,
    })
  }

  return entries
    .filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index)
    .sort((a, b) => timestampMs(b.occurredAt) - timestampMs(a.occurredAt))
}
