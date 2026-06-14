import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore"

import { buildNotificationDraft, type OperationalEventPayload } from "@/lib/notification-engine"
import { db } from "@/lib/firebase"
import type { Notification, SpmsUser, UserRole } from "@/models/firestore"
import type { AsyncState } from "@/services/firestore/crud"

type NotificationEngineResult = {
  notificationIds: string[]
  targetUserIds: string[]
}

function doneState<T>(data: T): AsyncState<T> {
  return { loading: false, data, error: null }
}

function errorState<T>(error: unknown): AsyncState<T> {
  return {
    loading: false,
    data: null,
    error: error instanceof Error ? error.message : String(error),
  }
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>
}

async function fetchUsersByRoles(roles: UserRole[]): Promise<Array<SpmsUser & { id: string }>> {
  if (roles.length === 0) return []
  const qRef = query(collection(db, "users"), where("role", "in", roles.slice(0, 10)))
  const snap = await getDocs(qRef)
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SpmsUser, "id">) }))
    .filter((user) => user.isActive)
}

async function existingNotificationForUser(input: {
  userId: string
  eventKey: string
}): Promise<boolean> {
  const qRef = query(
    collection(db, "notifications"),
    where("userId", "==", input.userId),
    where("eventKey", "==", input.eventKey)
  )
  const snap = await getDocs(qRef)
  return !snap.empty
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value?.trim()))]
}

export async function emitOperationalEventNotifications(input: {
  event: OperationalEventPayload
  actorUid: string
}): Promise<AsyncState<NotificationEngineResult>> {
  try {
    const roleTargets = await fetchUsersByRoles(input.event.targetRoles ?? [])
    const targetUserIds = uniqueStrings([
      ...roleTargets.map((user) => user.id),
      ...(input.event.targetUserIds ?? []),
    ])
    const targetRoleByUserId = new Map(roleTargets.map((user) => [user.id, user.role]))
    const draft = buildNotificationDraft(input.event)

    const batch = writeBatch(db)
    const notificationIds: string[] = []

    for (const userId of targetUserIds) {
      if (await existingNotificationForUser({ userId, eventKey: draft.eventKey })) {
        continue
      }
      const ref = doc(collection(db, "notifications"))
      notificationIds.push(ref.id)
      batch.set(ref, stripUndefined({
        userId,
        targetRole: targetRoleByUserId.get(userId),
        type: draft.type,
        channel: draft.channel,
        priority: draft.priority,
        eventPriority: draft.eventPriority,
        eventType: draft.eventType,
        eventKey: draft.eventKey,
        title: draft.title,
        body: draft.body,
        isRead: false,
        isArchived: false,
        refPath: draft.refPath,
        deliveryPayload: draft.deliveryPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies Omit<Notification, "id" | "createdAt" | "updatedAt" | "readAt" | "archivedAt"> & {
        createdAt: unknown
        updatedAt: unknown
      }))
    }

    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.actorUid,
      actionKey: "notification.generate",
      entityType: input.event.entityType,
      entityId: input.event.entityId,
      labelAr: `توليد إشعار تشغيلي: ${input.event.titleAr}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    if (input.event.eventPriority === "CRITICAL") {
      batch.set(doc(collection(db, "activityLogs")), {
        actorUid: input.actorUid,
        actionKey: "notification.escalation_trigger",
        entityType: input.event.entityType,
        entityId: input.event.entityId,
        labelAr: `تشغيل مسار تصعيد تشغيلي: ${input.event.titleAr}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    if (input.event.eventType === "METER_ANOMALY_DETECTED") {
      batch.set(doc(collection(db, "activityLogs")), {
        actorUid: input.actorUid,
        actionKey: "notification.anomaly_alert",
        entityType: input.event.entityType,
        entityId: input.event.entityId,
        labelAr: "تنبيه تشغيلي لشذوذ قراءة العداد",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    await batch.commit()
    return doneState({ notificationIds, targetUserIds })
  } catch (error) {
    return errorState<NotificationEngineResult>(error)
  }
}

export async function markNotificationRead(
  notificationId: string,
  isRead = true,
  actorUid?: string
): Promise<AsyncState<boolean>> {
  try {
    const batch = writeBatch(db)
    batch.update(doc(db, "notifications", notificationId), stripUndefined({
      isRead,
      readAt: isRead ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    }))
    if (actorUid) {
      batch.set(doc(collection(db, "activityLogs")), {
        actorUid,
        actionKey: isRead ? "notification.mark_read" : "notification.mark_unread",
        entityType: "notification",
        entityId: notificationId,
        labelAr: isRead ? "تعليم الإشعار كمقروء" : "تعليم الإشعار كغير مقروء",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    return doneState(true)
  } catch (error) {
    return errorState<boolean>(error)
  }
}

export async function archiveNotification(input: {
  notificationId: string
  archiveReason?: string
  actorUid?: string
}): Promise<AsyncState<boolean>> {
  try {
    const batch = writeBatch(db)
    batch.update(doc(db, "notifications", input.notificationId), stripUndefined({
      isArchived: true,
      archivedAt: serverTimestamp(),
      archiveReason: input.archiveReason?.trim() || undefined,
      updatedAt: serverTimestamp(),
    }))
    if (input.actorUid) {
      batch.set(doc(collection(db, "activityLogs")), {
        actorUid: input.actorUid,
        actionKey: "notification.archive",
        entityType: "notification",
        entityId: input.notificationId,
        labelAr: "أرشفة إشعار تشغيلي",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    return doneState(true)
  } catch (error) {
    return errorState<boolean>(error)
  }
}
