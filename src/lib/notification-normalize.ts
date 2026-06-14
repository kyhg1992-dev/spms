import { Timestamp, type DocumentData } from "firebase/firestore"

import type {
  Notification,
  NotificationPriority,
  OperationalEventType,
  OperationalNotificationPriority,
  UserRole,
} from "@/models/firestore"

function normalizePriority(v: unknown): NotificationPriority {
  return typeof v === "string" && ["low", "normal", "high", "critical"].includes(v)
    ? (v as NotificationPriority)
    : "normal"
}

function normalizeEventPriority(v: unknown): OperationalNotificationPriority | undefined {
  return typeof v === "string" && ["INFO", "WARNING", "CRITICAL"].includes(v)
    ? (v as OperationalNotificationPriority)
    : undefined
}

function normalizeEventType(v: unknown): OperationalEventType | undefined {
  return typeof v === "string" &&
    [
    "PM_DUE_SOON",
    "PM_OVERDUE",
    "PM_WORK_ORDER_GENERATED",
    "PM_COMPLETED_NEXT_SCHEDULED",
      "WORK_ORDER_ASSIGNED",
      "WORK_ORDER_REASSIGNED",
      "WORK_ORDER_COMPLETED",
      "WORK_ORDER_WAITING_APPROVAL",
      "APPROVAL_ACCEPTED",
      "APPROVAL_REJECTED",
      "METER_ANOMALY_DETECTED",
      "WORK_ORDER_DELEGATED",
      "DELEGATION_CANCELLED",
      "DELEGATED_TASK_ACCEPTED",
    ].includes(v)
    ? (v as OperationalEventType)
    : undefined
}

function normalizeTargetRole(v: unknown): UserRole | undefined {
  return typeof v === "string" && ["admin", "manager", "technician", "requester"].includes(v)
    ? (v as UserRole)
    : undefined
}

function normalizeRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

export function normalizeNotification(
  docId: string,
  data: DocumentData
): Notification & { id: string } {
  const d = data as Record<string, unknown>
  const createdAt =
    d.createdAt && typeof (d.createdAt as Timestamp).toMillis === "function"
      ? (d.createdAt as Timestamp)
      : Timestamp.now()
  const updatedAt =
    d.updatedAt && typeof (d.updatedAt as Timestamp).toMillis === "function"
      ? (d.updatedAt as Timestamp)
      : Timestamp.now()

  return {
    id: docId,
    createdAt,
    updatedAt,
    userId: typeof d.userId === "string" ? d.userId : "",
    targetRole: normalizeTargetRole(d.targetRole),
    type:
      typeof d.type === "string" && ["work_order", "pm_schedule", "asset", "system"].includes(d.type)
        ? (d.type as Notification["type"])
        : "system",
    channel:
      typeof d.channel === "string" && ["in_app", "email"].includes(d.channel)
        ? (d.channel as Notification["channel"])
        : "in_app",
    priority: normalizePriority(d.priority),
    eventPriority: normalizeEventPriority(d.eventPriority),
    eventType: normalizeEventType(d.eventType),
    eventKey: typeof d.eventKey === "string" ? d.eventKey : undefined,
    title: typeof d.title === "string" ? d.title : "",
    body: typeof d.body === "string" ? d.body : "",
    isRead: typeof d.isRead === "boolean" ? d.isRead : false,
    readAt:
      d.readAt && typeof (d.readAt as Timestamp).toMillis === "function"
        ? (d.readAt as Timestamp)
        : undefined,
    isArchived: typeof d.isArchived === "boolean" ? d.isArchived : false,
    archivedAt:
      d.archivedAt && typeof (d.archivedAt as Timestamp).toMillis === "function"
        ? (d.archivedAt as Timestamp)
        : undefined,
    archiveReason: typeof d.archiveReason === "string" ? d.archiveReason : undefined,
    refPath: typeof d.refPath === "string" ? d.refPath : undefined,
    deliveryPayload: normalizeRecord(d.deliveryPayload),
  }
}
