import type {
  NotificationPriority,
  NotificationType,
  OperationalEventType,
  OperationalNotificationPriority,
  UserRole,
} from "@/models/firestore"
import { notificationTimingDecision, type OperationalCalendar } from "@/lib/operational-calendar"

export type OperationalNotificationChannel = "in_app" | "email" | "mobile_push" | "whatsapp"

export type OperationalEventPayload = {
  eventType: OperationalEventType
  eventPriority: OperationalNotificationPriority
  titleAr: string
  bodyAr: string
  refPath?: string
  entityType: string
  entityId: string
  targetRoles?: UserRole[]
  targetUserIds?: string[]
  requestedChannels?: OperationalNotificationChannel[]
  escalationKey?: string
  metadata?: Record<string, unknown>
}

export type NotificationDraft = {
  type: NotificationType
  channel: "in_app" | "email"
  priority: NotificationPriority
  eventPriority: OperationalNotificationPriority
  eventType: OperationalEventType
  eventKey: string
  title: string
  body: string
  refPath?: string
  deliveryPayload: Record<string, unknown>
}

function notificationTypeForEvent(eventType: OperationalEventType): NotificationType {
  switch (eventType) {
    case "PM_DUE_SOON":
    case "PM_OVERDUE":
    case "PM_WORK_ORDER_GENERATED":
    case "PM_COMPLETED_NEXT_SCHEDULED":
      return "pm_schedule"
    case "WORK_ORDER_ASSIGNED":
    case "WORK_ORDER_REASSIGNED":
    case "WORK_ORDER_COMPLETED":
    case "WORK_ORDER_WAITING_APPROVAL":
    case "APPROVAL_ACCEPTED":
    case "APPROVAL_REJECTED":
    case "WORK_ORDER_DELEGATED":
    case "DELEGATION_CANCELLED":
    case "DELEGATED_TASK_ACCEPTED":
      return "work_order"
    case "METER_ANOMALY_DETECTED":
      return "asset"
  }
}

export function legacyPriorityFromOperational(
  priority: OperationalNotificationPriority
): NotificationPriority {
  switch (priority) {
    case "INFO":
      return "normal"
    case "WARNING":
      return "high"
    case "CRITICAL":
      return "critical"
  }
}

export function buildEventKey(input: {
  eventType: OperationalEventType
  entityType: string
  entityId: string
  escalationKey?: string
}): string {
  return [
    input.eventType,
    input.entityType,
    input.entityId,
    input.escalationKey ?? "default",
  ].join(":")
}

export function buildNotificationDraft(payload: OperationalEventPayload): NotificationDraft {
  const requestedChannels = payload.requestedChannels ?? ["in_app"]
  return {
    type: notificationTypeForEvent(payload.eventType),
    channel: requestedChannels.includes("email") ? "email" : "in_app",
    priority: legacyPriorityFromOperational(payload.eventPriority),
    eventPriority: payload.eventPriority,
    eventType: payload.eventType,
    eventKey: buildEventKey(payload),
    title: payload.titleAr,
    body: payload.bodyAr,
    refPath: payload.refPath,
    deliveryPayload: {
      eventType: payload.eventType,
      eventPriority: payload.eventPriority,
      entityType: payload.entityType,
      entityId: payload.entityId,
      requestedChannels,
      escalationKey: payload.escalationKey,
      metadata: payload.metadata ?? {},
      futureDelivery: {
        mobilePush: requestedChannels.includes("mobile_push"),
        email: requestedChannels.includes("email"),
        whatsapp: requestedChannels.includes("whatsapp"),
      },
    },
  }
}

export function prepareOperationalNotificationTiming(input: {
  payload: OperationalEventPayload
  calendar?: OperationalCalendar
  now?: Date
}) {
  return notificationTimingDecision({
    now: input.now,
    calendar: input.calendar,
    priority: input.payload.eventPriority,
  })
}

export function pmDueSoonEvent(input: {
  scheduleId: string
  title: string
  assetId: string
}): OperationalEventPayload {
  return {
    eventType: "PM_DUE_SOON",
    eventPriority: "WARNING",
    titleAr: "صيانة وقائية قريبة الاستحقاق",
    bodyAr: `الخطة ${input.title} تقترب من موعد الاستحقاق.`,
    refPath: `pmSchedules/${input.scheduleId}`,
    entityType: "pm_schedule",
    entityId: input.scheduleId,
    targetRoles: ["manager", "admin"],
    escalationKey: "pm-due-soon",
    metadata: { assetId: input.assetId },
  }
}

export function pmOverdueEvent(input: {
  scheduleId: string
  title: string
  assetId: string
  critical: boolean
}): OperationalEventPayload {
  return {
    eventType: "PM_OVERDUE",
    eventPriority: input.critical ? "CRITICAL" : "WARNING",
    titleAr: input.critical ? "صيانة وقائية حرجة" : "صيانة وقائية متأخرة",
    bodyAr: `الخطة ${input.title} تجاوزت حد الاستحقاق وتتطلب متابعة تشغيلية.`,
    refPath: `pmSchedules/${input.scheduleId}`,
    entityType: "pm_schedule",
    entityId: input.scheduleId,
    targetRoles: ["manager", "admin"],
    escalationKey: input.critical ? "pm-critical" : "pm-overdue",
    metadata: { assetId: input.assetId },
  }
}

export function pmWorkOrderGeneratedEvent(input: {
  scheduleId: string
  workOrderId: string
  title: string
  assetId: string
}): OperationalEventPayload {
  return {
    eventType: "PM_WORK_ORDER_GENERATED",
    eventPriority: "WARNING",
    titleAr: "تم إنشاء أمر عمل من خطة PM",
    bodyAr: `تم إنشاء أمر عمل تشغيلي للصيانة الوقائية: ${input.title}.`,
    refPath: `workOrders/${input.workOrderId}`,
    entityType: "pm_schedule",
    entityId: input.scheduleId,
    targetRoles: ["manager", "admin"],
    escalationKey: "pm-work-order-generated",
    metadata: { assetId: input.assetId, workOrderId: input.workOrderId },
  }
}

export function pmNextScheduledEvent(input: {
  scheduleId: string
  title: string
  assetId: string
  nextRunAtMs: number
}): OperationalEventPayload {
  return {
    eventType: "PM_COMPLETED_NEXT_SCHEDULED",
    eventPriority: "INFO",
    titleAr: "تمت جدولة الصيانة الوقائية التالية",
    bodyAr: `تم إكمال ${input.title} وحساب موعد الصيانة الوقائية التالية.`,
    refPath: `pmSchedules/${input.scheduleId}`,
    entityType: "pm_schedule",
    entityId: input.scheduleId,
    targetRoles: ["manager", "admin"],
    escalationKey: "pm-next-scheduled",
    metadata: { assetId: input.assetId, nextRunAtMs: input.nextRunAtMs },
  }
}

export function workOrderEvent(input: {
  eventType: Extract<
    OperationalEventType,
    | "WORK_ORDER_ASSIGNED"
    | "WORK_ORDER_REASSIGNED"
    | "WORK_ORDER_COMPLETED"
    | "WORK_ORDER_WAITING_APPROVAL"
    | "APPROVAL_ACCEPTED"
    | "APPROVAL_REJECTED"
    | "WORK_ORDER_DELEGATED"
    | "DELEGATION_CANCELLED"
    | "DELEGATED_TASK_ACCEPTED"
  >
  workOrderId: string
  title: string
  targetUserIds?: string[]
  requesterId?: string
}): OperationalEventPayload {
  const templates: Record<typeof input.eventType, { title: string; body: string; priority: OperationalNotificationPriority; roles: UserRole[] }> = {
    WORK_ORDER_ASSIGNED: {
      title: "تم إسناد أمر عمل",
      body: `تم إسناد أمر العمل ${input.title}.`,
      priority: "INFO",
      roles: ["manager", "admin"],
    },
    WORK_ORDER_REASSIGNED: {
      title: "تمت إعادة إسناد أمر عمل",
      body: `تمت إعادة إسناد أمر العمل ${input.title}.`,
      priority: "WARNING",
      roles: ["manager", "admin"],
    },
    WORK_ORDER_COMPLETED: {
      title: "تم إكمال أمر عمل",
      body: `تم إكمال أمر العمل ${input.title} وبانتظار المراجعة التشغيلية عند الحاجة.`,
      priority: "INFO",
      roles: ["manager", "admin"],
    },
    WORK_ORDER_WAITING_APPROVAL: {
      title: "أمر عمل بانتظار الاعتماد",
      body: `أمر العمل ${input.title} يتطلب اعتماد المشرف.`,
      priority: "WARNING",
      roles: ["manager", "admin"],
    },
    APPROVAL_ACCEPTED: {
      title: "تم اعتماد أمر العمل",
      body: `تم اعتماد أمر العمل ${input.title}.`,
      priority: "INFO",
      roles: ["manager", "admin"],
    },
    APPROVAL_REJECTED: {
      title: "تم رفض اعتماد أمر العمل",
      body: `تم رفض اعتماد أمر العمل ${input.title} وإعادته للمتابعة.`,
      priority: "WARNING",
      roles: ["manager", "admin"],
    },
    WORK_ORDER_DELEGATED: {
      title: "تم تفويض مهمة عمل",
      body: `تم تفويض أمر العمل ${input.title}.`,
      priority: "WARNING",
      roles: ["manager", "admin"],
    },
    DELEGATION_CANCELLED: {
      title: "تم إلغاء تفويض مهمة",
      body: `تم إلغاء تفويض أمر العمل ${input.title}.`,
      priority: "WARNING",
      roles: ["manager", "admin"],
    },
    DELEGATED_TASK_ACCEPTED: {
      title: "تم قبول مهمة مفوضة",
      body: `تم قبول تفويض أمر العمل ${input.title}.`,
      priority: "INFO",
      roles: ["manager", "admin"],
    },
  }
  const template = templates[input.eventType]
  return {
    eventType: input.eventType,
    eventPriority: template.priority,
    titleAr: template.title,
    bodyAr: template.body,
    refPath: `workOrders/${input.workOrderId}`,
    entityType: "work_order",
    entityId: input.workOrderId,
    targetRoles: template.roles,
    targetUserIds: [...(input.targetUserIds ?? []), ...(input.requesterId ? [input.requesterId] : [])],
    escalationKey: input.eventType.toLowerCase(),
  }
}

export function meterAnomalyEvent(input: {
  assetId: string
  assetCode: string
  meterReadingId: string
}): OperationalEventPayload {
  return {
    eventType: "METER_ANOMALY_DETECTED",
    eventPriority: "CRITICAL",
    titleAr: "تنبيه شذوذ في قراءة عداد",
    bodyAr: `تم رصد قراءة غير اعتيادية للأصل ${input.assetCode}.`,
    refPath: `assets/${input.assetId}`,
    entityType: "asset",
    entityId: input.assetId,
    targetRoles: ["manager", "admin"],
    requestedChannels: ["in_app", "mobile_push"],
    escalationKey: "meter-anomaly",
    metadata: { meterReadingId: input.meterReadingId },
  }
}
