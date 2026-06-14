import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore"

import { normalizeAsset } from "@/lib/asset-normalize"
import {
  applyMeterToAssetSnapshot,
  calculatePMSchedulePatch,
  detectMeterAnomaly,
} from "@/lib/pm-engine"
import {
  meterAnomalyEvent,
  pmDueSoonEvent,
  pmOverdueEvent,
} from "@/lib/notification-engine"
import { normalizePMSchedule } from "@/lib/pm-schedule-normalize"
import { db } from "@/lib/firebase"
import type {
  CompanySettings,
  Asset,
  MeterReading,
  MeterReadingKind,
  PMSchedule,
  UserRole,
} from "@/models/firestore"
import type { AsyncState } from "@/services/firestore/crud"
import { emitOperationalEventNotifications } from "@/services/firestore/notification-engine-service"
import { canAccess } from "@/services/firestore/permissions"

type PMEngineMeterInput = {
  assetId: string
  kind: MeterReadingKind
  value: number
  note?: string
  enteredByUid: string
}

type PMEngineMeterResult = {
  meterReadingId: string
  anomalyFlag: boolean
  deltaFromPrevious?: number
  recalculatedScheduleIds: string[]
}

type PMEngineRecalculateInput = {
  assetId: string
  actorUid: string
}

type PMEngineRecalculateResult = {
  recalculatedScheduleIds: string[]
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

function previousValueForKind(input: {
  kind: MeterReadingKind
  latestSameKind?: MeterReading & { id: string }
  assetHours: number
  assetKm: number
}): number | undefined {
  if (typeof input.latestSameKind?.value === "number") return input.latestSameKind.value
  return input.kind === "operating_hours" ? input.assetHours : input.assetKm
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>
}

function meterAssetPatch(kind: MeterReadingKind, value: number): Partial<Pick<Asset, "operatingHours" | "odometer">> {
  return kind === "operating_hours" ? { operatingHours: value } : { odometer: value }
}

function scheduleStatusLabel(status: string | undefined): string {
  switch (status) {
    case "CRITICAL":
      return "حرج"
    case "OVERDUE":
      return "متأخر"
    case "DUE_SOON":
      return "قريب الاستحقاق"
    default:
      return "سليم"
  }
}

async function emitPMScheduleNotifications(input: {
  actorUid: string
  schedules: Array<{
    schedule: PMSchedule & { id: string }
    patch: ReturnType<typeof calculatePMSchedulePatch>
  }>
}): Promise<void> {
  await Promise.all(
    input.schedules.map(async ({ schedule, patch }) => {
      if (patch.pmStatus === "DUE_SOON") {
        await emitOperationalEventNotifications({
          actorUid: input.actorUid,
          event: pmDueSoonEvent({
            scheduleId: schedule.id,
            title: schedule.title,
            assetId: schedule.assetId,
          }),
        })
      }
      if (patch.pmStatus === "OVERDUE" || patch.pmStatus === "CRITICAL") {
        await emitOperationalEventNotifications({
          actorUid: input.actorUid,
          event: pmOverdueEvent({
            scheduleId: schedule.id,
            title: schedule.title,
            assetId: schedule.assetId,
            critical: patch.pmStatus === "CRITICAL",
          }),
        })
      }
    })
  )
}

async function fetchLatestSameKind(assetId: string, kind: MeterReadingKind) {
  const qRef = query(
    collection(db, "meterReadings"),
    where("assetId", "==", assetId),
    orderBy("updatedAt", "desc"),
    limit(20)
  )
  const snap = await getDocs(qRef)
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<MeterReading, "id">) }))
    .find((row) => row.kind === kind)
}

async function fetchAssetSchedules(assetId: string): Promise<Array<PMSchedule & { id: string }>> {
  const qRef = query(collection(db, "pmSchedules"), where("assetId", "==", assetId))
  const snap = await getDocs(qRef)
  return snap.docs.map((d) => normalizePMSchedule(d.id, d.data()))
}

async function fetchCompanySettings(): Promise<(CompanySettings & { id: string }) | undefined> {
  const snap = await getDoc(doc(db, "companySettings", "main"))
  if (!snap.exists()) return undefined
  return { id: snap.id, ...(snap.data() as Omit<CompanySettings, "id">) }
}

export async function recordMeterReadingAndRunPMEngine(
  role: UserRole,
  input: PMEngineMeterInput
): Promise<AsyncState<PMEngineMeterResult>> {
  if (!canAccess(role, "meterReadings", "create")) {
    return errorState<PMEngineMeterResult>("Permission denied")
  }
  if (!input.assetId.trim()) return errorState<PMEngineMeterResult>("Asset id is required")
  if (!Number.isFinite(input.value) || input.value < 0) {
    return errorState<PMEngineMeterResult>("Meter value must be a non-negative number")
  }

  try {
    const assetRef = doc(db, "assets", input.assetId)
    const assetSnap = await getDoc(assetRef)
    if (!assetSnap.exists()) return errorState<PMEngineMeterResult>("Asset not found")

    const asset = normalizeAsset(assetSnap.id, assetSnap.data())
    const [latestSameKind, settings, schedules] = await Promise.all([
      fetchLatestSameKind(input.assetId, input.kind),
      fetchCompanySettings(),
      fetchAssetSchedules(input.assetId),
    ])

    const previousValue = previousValueForKind({
      kind: input.kind,
      latestSameKind,
      assetHours: asset.operatingHours,
      assetKm: asset.odometer,
    })
    const anomaly = detectMeterAnomaly({
      previousValue,
      nextValue: input.value,
      thresholdPct: settings?.meterAnomalyPct,
    })

    if (anomaly.reason === "METER_ROLLBACK") {
      return errorState<PMEngineMeterResult>("Meter value cannot be lower than the current recorded value")
    }

    const assetMeters = applyMeterToAssetSnapshot({
      asset,
      kind: input.kind,
      value: input.value,
    })
    const recalculated = schedules.map((schedule) => ({
      schedule,
      patch: calculatePMSchedulePatch({
        schedule,
        asset: assetMeters,
        settings,
      }),
    }))

    const batch = writeBatch(db)
    const meterRef = doc(collection(db, "meterReadings"))

    batch.set(meterRef, stripUndefined({
      assetId: input.assetId,
      kind: input.kind,
      value: input.value,
      deltaFromPrevious: anomaly.deltaFromPrevious,
      note: input.note?.trim() || undefined,
      enteredByUid: input.enteredByUid,
      anomalyFlag: anomaly.anomalyFlag,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))

    batch.update(assetRef, {
      ...meterAssetPatch(input.kind, input.value),
      updatedAt: serverTimestamp(),
    })

    recalculated.forEach(({ schedule, patch }) => {
      batch.update(doc(db, "pmSchedules", schedule.id), stripUndefined({
        ...patch,
        updatedAt: serverTimestamp(),
      }))
    })

    const auditBase = {
      actorUid: input.enteredByUid,
      entityType: "asset",
      entityId: input.assetId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    batch.set(doc(collection(db, "activityLogs")), {
      ...auditBase,
      actionKey: "meter.update",
      labelAr:
        input.kind === "operating_hours"
          ? `تحديث عداد ساعات التشغيل للأصل ${asset.assetCode}`
          : `تحديث عداد الكيلومترات للأصل ${asset.assetCode}`,
    })

    recalculated.forEach(({ schedule, patch }) => {
      batch.set(doc(collection(db, "activityLogs")), {
        actorUid: input.enteredByUid,
        actionKey: "pm.recalculate",
        entityType: "pm_schedule",
        entityId: schedule.id,
        labelAr: `إعادة حساب PM (${schedule.title}) - الحالة ${scheduleStatusLabel(patch.pmStatus)}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    if (anomaly.anomalyFlag) {
      batch.set(doc(collection(db, "activityLogs")), {
        ...auditBase,
        actionKey: "meter.anomaly",
        labelAr: `رصد شذوذ في قراءة العداد للأصل ${asset.assetCode}`,
      })
    }

    await batch.commit()

    await emitPMScheduleNotifications({
      actorUid: input.enteredByUid,
      schedules: recalculated,
    })

    if (anomaly.anomalyFlag) {
      await emitOperationalEventNotifications({
        actorUid: input.enteredByUid,
        event: meterAnomalyEvent({
          assetId: input.assetId,
          assetCode: asset.assetCode,
          meterReadingId: meterRef.id,
        }),
      })
    }

    return doneState({
      meterReadingId: meterRef.id,
      anomalyFlag: anomaly.anomalyFlag,
      deltaFromPrevious: anomaly.deltaFromPrevious,
      recalculatedScheduleIds: recalculated.map(({ schedule }) => schedule.id),
    })
  } catch (error) {
    return errorState<PMEngineMeterResult>(error)
  }
}

export async function recalculatePMSchedulesForAsset(
  role: UserRole,
  input: PMEngineRecalculateInput
): Promise<AsyncState<PMEngineRecalculateResult>> {
  if (!canAccess(role, "meterReadings", "create")) {
    return errorState<PMEngineRecalculateResult>("Permission denied")
  }
  if (!input.assetId.trim()) return errorState<PMEngineRecalculateResult>("Asset id is required")

  try {
    const assetSnap = await getDoc(doc(db, "assets", input.assetId))
    if (!assetSnap.exists()) return errorState<PMEngineRecalculateResult>("Asset not found")

    const asset = normalizeAsset(assetSnap.id, assetSnap.data())
    const [settings, schedules] = await Promise.all([
      fetchCompanySettings(),
      fetchAssetSchedules(input.assetId),
    ])

    const batch = writeBatch(db)
    const recalculated = schedules.map((schedule) => ({
      schedule,
      patch: calculatePMSchedulePatch({
        schedule,
        asset,
        settings,
      }),
    }))

    recalculated.forEach(({ schedule, patch }) => {
      batch.update(doc(db, "pmSchedules", schedule.id), stripUndefined({
        ...patch,
        updatedAt: serverTimestamp(),
      }))
      batch.set(doc(collection(db, "activityLogs")), {
        actorUid: input.actorUid,
        actionKey: "pm.recalculate",
        entityType: "pm_schedule",
        entityId: schedule.id,
        labelAr: `إعادة حساب PM (${schedule.title}) - الحالة ${scheduleStatusLabel(patch.pmStatus)}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    await batch.commit()

    await emitPMScheduleNotifications({
      actorUid: input.actorUid,
      schedules: recalculated,
    })

    return doneState({
      recalculatedScheduleIds: recalculated.map(({ schedule }) => schedule.id),
    })
  } catch (error) {
    return errorState<PMEngineRecalculateResult>(error)
  }
}
