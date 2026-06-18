import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore"

import { normalizeAsset } from "@/lib/asset-normalize"
import { pmNextScheduledEvent, pmWorkOrderGeneratedEvent } from "@/lib/notification-engine"
import {
  assertIntegrity,
  validateNoOpenPMDuplicate,
  validatePMWorkOrderLink,
} from "@/lib/operational-integrity"
import { operationalCalendarFromSettings, type OperationalCalendar } from "@/lib/operational-calendar"
import { calculatePMSchedulePatch } from "@/lib/pm-engine"
import { computeNextCode, occurrenceLabelForIndex } from "@/lib/maintenance-sequence"
import { normalizeMaintenanceTemplate } from "@/lib/maintenance-sequence-normalize"
import { normalizePMSchedule } from "@/lib/pm-schedule-normalize"
import { normalizeWorkOrder } from "@/lib/work-order-normalize"
import { db } from "@/lib/firebase"
import type {
  Asset,
  CompanySettings,
  MeterReading,
  PMSchedule,
  UserRole,
  WorkOrder,
} from "@/models/firestore"
import type { AsyncState } from "@/services/firestore/crud"
import { emitOperationalEventNotifications } from "@/services/firestore/notification-engine-service"
import { canAccess } from "@/services/firestore/permissions"

type PMWorkOrderResult = {
  workOrderId: string
  duplicatePrevented: boolean
}

type PMCompletionResult = {
  pmScheduleId: string
  nextRunAtMs: number
}

const ACTIVE_PM_WORK_ORDER_STATUSES: WorkOrder["status"][] = [
  "open",
  "assigned",
  "in_progress",
  "waiting_parts",
  "waiting_approval",
]

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

function addDays(base: Date, days: number): Timestamp {
  const next = new Date(base)
  next.setDate(next.getDate() + Math.max(0, days))
  return Timestamp.fromDate(next)
}

async function loadSchedule(pmScheduleId: string): Promise<PMSchedule & { id: string }> {
  const snap = await getDoc(doc(db, "pmSchedules", pmScheduleId))
  if (!snap.exists()) throw new Error("PM schedule not found")
  return normalizePMSchedule(snap.id, snap.data())
}

async function loadAsset(assetId: string): Promise<Asset & { id: string }> {
  const snap = await getDoc(doc(db, "assets", assetId))
  if (!snap.exists()) throw new Error("Asset not found")
  return normalizeAsset(snap.id, snap.data())
}

async function loadWorkOrder(workOrderId: string): Promise<WorkOrder & { id: string }> {
  const snap = await getDoc(doc(db, "workOrders", workOrderId))
  if (!snap.exists()) throw new Error("Work order not found")
  return normalizeWorkOrder(snap.id, snap.data())
}

async function loadMaintenanceTemplate(templateId: string) {
  const snap = await getDoc(doc(db, "maintenanceTemplates", templateId))
  if (!snap.exists()) return null
  return normalizeMaintenanceTemplate(snap.id, snap.data())
}

const ACTION_AR: Record<string, string> = {
  REPLACE: "استبدال",
  CLEAN: "تنظيف",
  CHECK: "فحص",
  DRAIN: "تصريف",
  GREASE: "تشحيم",
  ADJUST: "ضبط",
  WASH: "غسيل",
  REFILL: "تعبئة",
}

/** Build the work-order fields (tasks + checklist + parts note) for a template level. */
function buildServiceLevelPayload(
  template: Awaited<ReturnType<typeof loadMaintenanceTemplate>>,
  levelCode: string
): Record<string, unknown> {
  const level = template?.levels?.find((l) => l.code === levelCode)
  if (!template || !level) return {}

  const serviceTasks = level.tasks.map((t) => stripUndefined({ ...t }))
  const executionChecklist = level.tasks.map((t, i) =>
    stripUndefined({
      id: `tpl-${level.code}-${String(i)}`,
      labelAr: `${ACTION_AR[t.action] ?? t.action} — ${t.descAr}${t.qty ? ` (${t.qty})` : ""}`,
      labelEn: t.descEn ? `${t.action} — ${t.descEn}` : undefined,
      isDone: false,
      note: t.partNo || undefined,
    })
  )
  const requiredPartsNote = level.tasks
    .filter((t) => t.itemCode)
    .map((t) => `${t.descAr} (${t.itemCode})${t.qty ? ` ×${t.qty}` : ""}`)
    .join(" · ")

  return {
    serviceLevelCode: level.code,
    serviceLevelNameAr: level.nameAr,
    serviceTasks,
    executionChecklist,
    ...(requiredPartsNote ? { requiredPartsNote } : {}),
  }
}

/**
 * For a PM schedule bound to a sequence template, resolve the level being
 * performed (schedule.serviceType) and return its work-order task payload.
 */
async function serviceLevelPayloadForSchedule(schedule: PMSchedule): Promise<Record<string, unknown>> {
  if (!schedule.maintenanceTemplateId) return {}
  const template = await loadMaintenanceTemplate(schedule.maintenanceTemplateId)
  return buildServiceLevelPayload(template, schedule.serviceType)
}

/**
 * When a PM schedule is bound to a sequence template, advance its service code
 * one step along the A/B/C/D rotation on completion and remember the meter value
 * the service was performed at. Returns an empty patch when no template is linked.
 */
async function sequenceAdvancementPatch(input: {
  schedule: PMSchedule
  meters: { operatingHours: number; odometer: number }
}): Promise<Partial<Pick<PMSchedule, "serviceType" | "lastServiceReading">>> {
  if (!input.schedule.maintenanceTemplateId) return {}

  const template = await loadMaintenanceTemplate(input.schedule.maintenanceTemplateId)
  if (!template || template.sequence.length === 0 || !(template.stepInterval > 0)) return {}

  const currentReading =
    template.meterKind === "odometer" ? input.meters.odometer : input.meters.operatingHours
  const lastReading = input.schedule.lastServiceReading ?? currentReading
  const next = computeNextCode(template, input.schedule.serviceType, currentReading, lastReading)

  return { serviceType: next.nextCode, lastServiceReading: currentReading }
}

async function fetchCompanySettings(): Promise<(CompanySettings & { id: string }) | undefined> {
  const snap = await getDoc(doc(db, "companySettings", "main"))
  if (!snap.exists()) return undefined
  return { id: snap.id, ...(snap.data() as Omit<CompanySettings, "id">) }
}

async function findOpenPMWorkOrder(input: {
  assetId: string
  pmScheduleId: string
}): Promise<(WorkOrder & { id: string }) | null> {
  const qRef = query(
    collection(db, "workOrders"),
    where("assetId", "==", input.assetId),
    where("pmScheduleId", "==", input.pmScheduleId),
    where("status", "in", ACTIVE_PM_WORK_ORDER_STATUSES)
  )
  const snap = await getDocs(qRef)
  const first = snap.docs[0]
  return first ? normalizeWorkOrder(first.id, first.data()) : null
}

/**
 * Any non-terminal work order already open on this asset. Used to block opening a
 * second request while one is still being processed. Queries by assetId only
 * (single-field, auto-indexed) and filters status in memory — an asset has few WOs.
 */
async function findActiveWorkOrderForAsset(assetId: string): Promise<(WorkOrder & { id: string }) | null> {
  const snap = await getDocs(query(collection(db, "workOrders"), where("assetId", "==", assetId)))
  const active = snap.docs
    .map((d) => normalizeWorkOrder(d.id, d.data()))
    .find((wo) => (ACTIVE_PM_WORK_ORDER_STATUSES as string[]).includes(wo.status))
  return active ?? null
}

async function latestReading(assetId: string, kind: MeterReading["kind"]): Promise<(MeterReading & { id: string }) | null> {
  const qRef = query(
    collection(db, "meterReadings"),
    where("assetId", "==", assetId),
    where("kind", "==", kind),
    orderBy("updatedAt", "desc"),
    limit(1)
  )
  const snap = await getDocs(qRef)
  const first = snap.docs[0]
  return first ? { id: first.id, ...(first.data() as Omit<MeterReading, "id">) } : null
}

function completedMeters(input: {
  asset: Asset
  workOrder: WorkOrder
  latestHours?: MeterReading | null
  latestKm?: MeterReading | null
}) {
  const execution = input.workOrder.meterReadingAtExecution
  const executionHours = execution?.kind === "operating_hours" ? execution.value : undefined
  const executionKm = execution?.kind === "odometer" ? execution.value : undefined
  return {
    operatingHours: Math.max(
      input.asset.operatingHours ?? 0,
      input.latestHours?.value ?? 0,
      executionHours ?? 0
    ),
    odometer: Math.max(
      input.asset.odometer ?? 0,
      input.latestKm?.value ?? 0,
      executionKm ?? 0
    ),
  }
}

function completionSchedulePatch(input: {
  schedule: PMSchedule
  asset: Pick<Asset, "operatingHours" | "odometer">
  settings?: Pick<CompanySettings, "defaultPmReminderDays">
  completedAt: Date
  calendar?: OperationalCalendar
}) {
  const nextRunAt = addDays(input.completedAt, input.schedule.frequencyDays)
  const nextDueHours =
    (input.schedule.triggerMode === "hours" || input.schedule.triggerMode === "both") &&
    input.schedule.meterHoursInterval
      ? input.asset.operatingHours + input.schedule.meterHoursInterval
      : input.schedule.nextDueHours
  const nextDueKm =
    (input.schedule.triggerMode === "km" || input.schedule.triggerMode === "both") &&
    input.schedule.meterKmInterval
      ? input.asset.odometer + input.schedule.meterKmInterval
      : input.schedule.nextDueKm

  return {
    ...calculatePMSchedulePatch({
      schedule: {
        ...input.schedule,
        lastRunAt: Timestamp.fromDate(input.completedAt),
        nextRunAt,
        nextDueHours,
        nextDueKm,
      },
      asset: input.asset,
      settings: input.settings,
      nowMs: input.completedAt.getTime(),
      calendar: input.calendar,
    }),
    nextRunAt,
    nextDueHours,
    nextDueKm,
    overdueStatus: false,
    dueSoonStatus: false,
    pmStatus: "OK" as const,
  }
}

export async function generateWorkOrderFromPMSchedule(input: {
  role: UserRole
  pmScheduleId: string
  actorUid: string
}): Promise<AsyncState<PMWorkOrderResult>> {
  if (!canAccess(input.role, "workOrders", "create")) return errorState<PMWorkOrderResult>("Permission denied")

  try {
    const schedule = await loadSchedule(input.pmScheduleId)
    if (!schedule.isActive) throw new Error("Paused PM schedules cannot generate work orders")
    const [asset, duplicate] = await Promise.all([
      loadAsset(schedule.assetId),
      findOpenPMWorkOrder({ assetId: schedule.assetId, pmScheduleId: schedule.id }),
    ])
    if (duplicate) {
      const duplicateCheck = validateNoOpenPMDuplicate({ existingWorkOrder: duplicate })
      if (!duplicateCheck.ok) {
        return doneState({ workOrderId: duplicate.id, duplicatePrevented: true })
      }
      return doneState({ workOrderId: duplicate.id, duplicatePrevented: true })
    }

    const serviceLevelPayload = await serviceLevelPayloadForSchedule(schedule)

    const woRef = doc(collection(db, "workOrders"))
    const batch = writeBatch(db)
    batch.set(woRef, stripUndefined({
      title: `PM - ${schedule.title}`,
      description: `Preventive maintenance generated from PM schedule ${schedule.title} for asset ${asset.assetCode}.`,
      assetId: schedule.assetId,
      requesterId: input.actorUid,
      status: "open",
      lifecycleStatus: "OPEN",
      priority: schedule.pmStatus === "CRITICAL" ? "critical" : schedule.pmStatus === "OVERDUE" ? "high" : "medium",
      dueDate: schedule.nextRunAt,
      approvalRequired: true,
      pmScheduleId: schedule.id,
      sourceType: "PM",
      sourceRef: `pmSchedules/${schedule.id}`,
      ...serviceLevelPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    batch.update(doc(db, "pmSchedules", schedule.id), {
      lastGeneratedWorkOrderId: woRef.id,
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.actorUid,
      actionKey: "pm.work_order_generated",
      entityType: "pm_schedule",
      entityId: schedule.id,
      labelAr: `إنشاء أمر عمل من خطة الصيانة الوقائية ${schedule.title}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await batch.commit()

    await emitOperationalEventNotifications({
      actorUid: input.actorUid,
      event: pmWorkOrderGeneratedEvent({
        scheduleId: schedule.id,
        workOrderId: woRef.id,
        title: schedule.title,
        assetId: schedule.assetId,
      }),
    })

    return doneState({ workOrderId: woRef.id, duplicatePrevented: false })
  } catch (error) {
    return errorState<PMWorkOrderResult>(error)
  }
}

export async function generateServiceWorkOrderFromAsset(input: {
  role: UserRole
  assetId: string
  actorUid: string
}): Promise<AsyncState<{ workOrderId: string }>> {
  if (!canAccess(input.role, "workOrders", "create")) {
    return errorState<{ workOrderId: string }>("Permission denied")
  }
  try {
    const asset = await loadAsset(input.assetId)
    if (!asset.maintenanceTemplateId) throw new Error("الأصل غير مرتبط بقالب صيانة")
    const template = await loadMaintenanceTemplate(asset.maintenanceTemplateId)
    if (!template) throw new Error("قالب الصيانة غير موجود")

    // Block opening a second request while one is still under processing.
    const existing = await findActiveWorkOrderForAsset(asset.id)
    if (existing) {
      return errorState<{ workOrderId: string }>(
        `يوجد أمر عمل قيد المعالجة بالفعل لهذا الأصل (${existing.serviceLevelCode ?? existing.title}). أغلقه أولاً قبل فتح أمر جديد.`
      )
    }

    const currentReading =
      template.meterKind === "odometer" ? asset.odometer ?? 0 : asset.operatingHours ?? 0
    const lastReading = asset.lastServiceReading ?? currentReading
    const next = computeNextCode(
      template,
      asset.lastServiceCode ?? null,
      currentReading,
      lastReading,
      asset.lastServiceIndex ?? null
    )
    const nextLabel = occurrenceLabelForIndex(template.sequence, next.nextIndex) || next.nextCode
    const payload = buildServiceLevelPayload(template, next.nextCode)

    const woRef = doc(collection(db, "workOrders"))
    const batch = writeBatch(db)
    batch.set(
      woRef,
      stripUndefined({
        title: `صيانة ${nextLabel} — ${asset.assetName}`,
        description: `أمر صيانة مستوى ${nextLabel} للأصل ${asset.assetCode} وفق قالب ${template.name}.`,
        assetId: asset.id,
        requesterId: input.actorUid,
        status: "open",
        lifecycleStatus: "OPEN",
        priority: next.isDue
          ? next.overdueBy > template.stepInterval
            ? "critical"
            : "high"
          : "medium",
        approvalRequired: true,
        sourceType: "PM",
        sourceRef: `assets/${asset.id}`,
        ...payload,
        serviceLevelIndex: next.nextIndex,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    )
    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.actorUid,
      actionKey: "asset.service_work_order_generated",
      entityType: "asset",
      entityId: asset.id,
      labelAr: `توليد أمر صيانة مستوى ${nextLabel} للأصل ${asset.assetCode}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await batch.commit()
    return doneState({ workOrderId: woRef.id })
  } catch (error) {
    return errorState<{ workOrderId: string }>(error)
  }
}

export async function completePMThroughWorkOrder(input: {
  role: UserRole
  pmScheduleId: string
  workOrderId: string
  actorUid: string
}): Promise<AsyncState<PMCompletionResult>> {
  if (!canAccess(input.role, "pmSchedules", "update")) return errorState<PMCompletionResult>("Permission denied")

  try {
    const [schedule, workOrder, settings] = await Promise.all([
      loadSchedule(input.pmScheduleId),
      loadWorkOrder(input.workOrderId),
      fetchCompanySettings(),
    ])
    assertIntegrity(validatePMWorkOrderLink({ schedule, workOrder }))

    const [asset, latestHours, latestKm] = await Promise.all([
      loadAsset(schedule.assetId),
      latestReading(schedule.assetId, "operating_hours"),
      latestReading(schedule.assetId, "odometer"),
    ])
    const completedAt = new Date()
    const meters = completedMeters({ asset, workOrder, latestHours, latestKm })
    const calendar = operationalCalendarFromSettings(settings)
    const patch = completionSchedulePatch({ schedule, asset: meters, settings, completedAt, calendar })
    const sequencePatch = await sequenceAdvancementPatch({ schedule, meters })

    const batch = writeBatch(db)
    batch.update(doc(db, "pmSchedules", schedule.id), stripUndefined({
      ...patch,
      ...sequencePatch,
      lastRunAt: serverTimestamp(),
      lastCompletedWorkOrderId: workOrder.id,
      updatedAt: serverTimestamp(),
    }))
    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.actorUid,
      actionKey: "pm.completed_from_work_order",
      entityType: "pm_schedule",
      entityId: schedule.id,
      labelAr: `إكمال خطة الصيانة الوقائية ${schedule.title} من أمر عمل مرتبط`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await batch.commit()

    await emitOperationalEventNotifications({
      actorUid: input.actorUid,
      event: pmNextScheduledEvent({
        scheduleId: schedule.id,
        title: schedule.title,
        assetId: schedule.assetId,
        nextRunAtMs: patch.nextRunAt.toMillis(),
      }),
    })

    return doneState({ pmScheduleId: schedule.id, nextRunAtMs: patch.nextRunAt.toMillis() })
  } catch (error) {
    return errorState<PMCompletionResult>(error)
  }
}
