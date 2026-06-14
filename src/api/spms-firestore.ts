import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore"

import { normalizeAsset } from "@/lib/asset-normalize"
import { normalizeMaintenanceTemplate } from "@/lib/maintenance-sequence-normalize"
import { normalizeNotification } from "@/lib/notification-normalize"
import { normalizePMSchedule } from "@/lib/pm-schedule-normalize"
import { normalizeWorkOrder } from "@/lib/work-order-normalize"
import { db } from "@/lib/firebase"
import type {
  ActivityLogEntry,
  Asset,
  CompanySettings,
  MaintenanceSequenceTemplate,
  MeterReading,
  Notification,
  PMSchedule,
  SpmsUser,
  UserRole,
  WorkOrder,
} from "@/models/firestore"

const COMPANY_DOC_ID = "main"

function visibleNotifications(rows: (Notification & { id: string })[]): (Notification & { id: string })[] {
  return rows.filter((row) => !row.isArchived)
}

export async function fetchCompanySettings(): Promise<(CompanySettings & { id: string }) | null> {
  const ref = doc(db, "companySettings", COMPANY_DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<CompanySettings, "id">) }
}

export async function fetchAssets(): Promise<(Asset & { id: string })[]> {
  const q = query(collection(db, "assets"), orderBy("updatedAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => normalizeAsset(d.id, d.data()))
}

export function subscribeAssets(
  onData: (rows: (Asset & { id: string })[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const qRef = query(collection(db, "assets"), orderBy("updatedAt", "desc"))
  return onSnapshot(
    qRef,
    (snap) => {
      onData(snap.docs.map((d) => normalizeAsset(d.id, d.data())))
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  )
}

function workOrdersQueryForViewer(uid?: string, role?: UserRole | null) {
  const canReadAll = role === "admin" || role === "manager"
  if (!canReadAll && uid) {
    const field = role === "requester" ? "requesterId" : "assignedTo"
    return query(collection(db, "workOrders"), where(field, "==", uid), orderBy("updatedAt", "desc"))
  }
  return query(collection(db, "workOrders"), orderBy("updatedAt", "desc"))
}

export async function fetchWorkOrders(
  uid?: string,
  role?: UserRole | null
): Promise<(WorkOrder & { id: string })[]> {
  const qRef = workOrdersQueryForViewer(uid, role)
  const snap = await getDocs(qRef)
  return snap.docs.map((d) => normalizeWorkOrder(d.id, d.data()))
}

export function subscribeWorkOrders(
  onData: (rows: (WorkOrder & { id: string })[]) => void,
  onError?: (e: Error) => void,
  uid?: string,
  role?: UserRole | null
): Unsubscribe {
  const qRef = workOrdersQueryForViewer(uid, role)
  return onSnapshot(
    qRef,
    (snap) => onData(snap.docs.map((d) => normalizeWorkOrder(d.id, d.data()))),
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  )
}

export async function fetchPMSchedules(): Promise<(PMSchedule & { id: string })[]> {
  const qRef = query(collection(db, "pmSchedules"), orderBy("updatedAt", "desc"))
  const snap = await getDocs(qRef)
  return snap.docs.map((d) => normalizePMSchedule(d.id, d.data()))
}

export function subscribePMSchedules(
  onData: (rows: (PMSchedule & { id: string })[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const qRef = query(collection(db, "pmSchedules"), orderBy("updatedAt", "desc"))
  return onSnapshot(
    qRef,
    (snap) => onData(snap.docs.map((d) => normalizePMSchedule(d.id, d.data()))),
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  )
}

export async function fetchMaintenanceTemplates(): Promise<
  (MaintenanceSequenceTemplate & { id: string })[]
> {
  const qRef = query(collection(db, "maintenanceTemplates"), orderBy("templateCode", "asc"))
  const snap = await getDocs(qRef)
  return snap.docs.map((d) => normalizeMaintenanceTemplate(d.id, d.data()))
}

export async function fetchNotificationsForUser(
  uid: string,
  canReadAll: boolean
): Promise<(Notification & { id: string })[]> {
  if (canReadAll) {
    const qRef = query(collection(db, "notifications"), orderBy("updatedAt", "desc"))
    const snap = await getDocs(qRef)
    return visibleNotifications(snap.docs.map((d) => normalizeNotification(d.id, d.data())))
  }
  const qRef = query(
    collection(db, "notifications"),
    where("userId", "==", uid),
    orderBy("updatedAt", "desc")
  )
  const snap = await getDocs(qRef)
  return visibleNotifications(snap.docs.map((d) => normalizeNotification(d.id, d.data())))
}

export function subscribeNotificationsForUser(
  uid: string,
  canReadAll: boolean,
  onData: (rows: (Notification & { id: string })[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const qRef = canReadAll
    ? query(collection(db, "notifications"), orderBy("updatedAt", "desc"))
    : query(collection(db, "notifications"), where("userId", "==", uid), orderBy("updatedAt", "desc"))
  return onSnapshot(
    qRef,
    (snap) => onData(visibleNotifications(snap.docs.map((d) => normalizeNotification(d.id, d.data())))),
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  )
}

export async function fetchUsers(): Promise<(SpmsUser & { id: string })[]> {
  const qRef = query(collection(db, "users"), orderBy("updatedAt", "desc"))
  const snap = await getDocs(qRef)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SpmsUser, "id">) }))
}

export async function fetchMeterReadings(assetId: string): Promise<(MeterReading & { id: string })[]> {
  const qRef = query(
    collection(db, "meterReadings"),
    where("assetId", "==", assetId),
    orderBy("updatedAt", "desc"),
    limit(100)
  )
  const snap = await getDocs(qRef)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeterReading, "id">) }))
}

export async function fetchActivityLogs(limitN = 200): Promise<(ActivityLogEntry & { id: string })[]> {
  const qRef = query(collection(db, "activityLogs"), orderBy("updatedAt", "desc"), limit(limitN))
  const snap = await getDocs(qRef)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLogEntry, "id">) }))
}
