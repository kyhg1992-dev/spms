import { Timestamp } from "firebase/firestore"

import { nextOperationalTimestamp, type OperationalCalendar } from "@/lib/operational-calendar"
import type { Asset, CompanySettings, PMSchedule, PMStatus } from "@/models/firestore"

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DUE_SOON_RATIO = 0.1
const DEFAULT_CRITICAL_RATIO = 0.1

type MeterSnapshot = {
  operatingHours: number
  odometer: number
}

export type PMEngineStatus = PMStatus

export type PMCalculationResult = {
  nextDueHours?: number
  nextDueKm?: number
  nextRunAt: Timestamp
  overdueStatus: boolean
  dueSoonStatus: boolean
  pmStatus: PMEngineStatus
}

export type MeterAnomalyResult = {
  anomalyFlag: boolean
  reason?: string
  deltaFromPrevious?: number
  thresholdPct: number
}

function toMillis(ts: Timestamp | undefined, fallbackMs: number): number {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : fallbackMs
}

function addDays(base: Timestamp | undefined, days: number, nowMs: number): Timestamp {
  const baseMs = toMillis(base, nowMs)
  return Timestamp.fromMillis(baseMs + Math.max(0, days) * DAY_MS)
}

function severityRank(status: PMEngineStatus): number {
  switch (status) {
    case "CRITICAL":
      return 3
    case "OVERDUE":
      return 2
    case "DUE_SOON":
      return 1
    case "OK":
      return 0
  }
}

function highestStatus(statuses: PMEngineStatus[]): PMEngineStatus {
  return statuses.reduce<PMEngineStatus>(
    (highest, next) => (severityRank(next) > severityRank(highest) ? next : highest),
    "OK"
  )
}

function meterStatus(input: {
  currentValue: number
  nextDueValue?: number
  interval?: number
}): PMEngineStatus {
  const { currentValue, nextDueValue, interval } = input
  if (typeof nextDueValue !== "number" || typeof interval !== "number" || interval <= 0) return "OK"

  const dueSoonAt = nextDueValue - interval * DEFAULT_DUE_SOON_RATIO
  const criticalAt = nextDueValue + interval * DEFAULT_CRITICAL_RATIO
  if (currentValue >= criticalAt) return "CRITICAL"
  if (currentValue >= nextDueValue) return "OVERDUE"
  if (currentValue >= dueSoonAt) return "DUE_SOON"
  return "OK"
}

function timeStatus(input: {
  nextRunAt: Timestamp
  reminderDays: number
  frequencyDays: number
  nowMs: number
}): PMEngineStatus {
  const dueMs = input.nextRunAt.toMillis()
  const dueSoonAt = dueMs - Math.max(0, input.reminderDays) * DAY_MS
  const criticalAt = dueMs + Math.max(1, input.frequencyDays) * DEFAULT_CRITICAL_RATIO * DAY_MS
  if (input.nowMs >= criticalAt) return "CRITICAL"
  if (input.nowMs >= dueMs) return "OVERDUE"
  if (input.nowMs >= dueSoonAt) return "DUE_SOON"
  return "OK"
}

function shouldUseHours(schedule: PMSchedule): boolean {
  return schedule.triggerMode === "hours" || schedule.triggerMode === "both"
}

function shouldUseKm(schedule: PMSchedule): boolean {
  return schedule.triggerMode === "km" || schedule.triggerMode === "both"
}

function shouldUseTime(schedule: PMSchedule): boolean {
  return schedule.triggerMode === "time" || schedule.triggerMode === "both"
}

export function calculateNextRunAt(
  schedule: PMSchedule,
  nowMs = Date.now(),
  calendar?: OperationalCalendar
): Timestamp {
  const adjust = (value: Timestamp) =>
    calendar ? nextOperationalTimestamp({ from: value, calendar }) : value

  if (schedule.nextRunAt && typeof schedule.nextRunAt.toMillis === "function") {
    return adjust(schedule.nextRunAt)
  }
  return adjust(addDays(schedule.lastRunAt ?? schedule.createdAt, schedule.frequencyDays, nowMs))
}

export function calculatePMStatus(input: {
  schedule: PMSchedule
  asset: MeterSnapshot
  settings?: Pick<CompanySettings, "defaultPmReminderDays">
  nowMs?: number
  calendar?: OperationalCalendar
}): PMCalculationResult {
  const nowMs = input.nowMs ?? Date.now()
  const nextRunAt = calculateNextRunAt(input.schedule, nowMs, input.calendar)
  const statuses: PMEngineStatus[] = []

  const nextDueHours =
    shouldUseHours(input.schedule) && input.schedule.meterHoursInterval
      ? input.schedule.nextDueHours ?? input.asset.operatingHours + input.schedule.meterHoursInterval
      : input.schedule.nextDueHours

  const nextDueKm =
    shouldUseKm(input.schedule) && input.schedule.meterKmInterval
      ? input.schedule.nextDueKm ?? input.asset.odometer + input.schedule.meterKmInterval
      : input.schedule.nextDueKm

  if (input.schedule.isActive && shouldUseTime(input.schedule)) {
    statuses.push(
      timeStatus({
        nextRunAt,
        reminderDays: input.settings?.defaultPmReminderDays ?? 7,
        frequencyDays: input.schedule.frequencyDays,
        nowMs,
      })
    )
  }

  if (input.schedule.isActive && shouldUseHours(input.schedule)) {
    statuses.push(
      meterStatus({
        currentValue: input.asset.operatingHours,
        nextDueValue: nextDueHours,
        interval: input.schedule.meterHoursInterval,
      })
    )
  }

  if (input.schedule.isActive && shouldUseKm(input.schedule)) {
    statuses.push(
      meterStatus({
        currentValue: input.asset.odometer,
        nextDueValue: nextDueKm,
        interval: input.schedule.meterKmInterval,
      })
    )
  }

  const pmStatus = input.schedule.isActive ? highestStatus(statuses) : "OK"

  return {
    nextDueHours,
    nextDueKm,
    nextRunAt,
    overdueStatus: pmStatus === "OVERDUE" || pmStatus === "CRITICAL",
    dueSoonStatus: pmStatus === "DUE_SOON",
    pmStatus,
  }
}

export function calculatePMSchedulePatch(input: {
  schedule: PMSchedule
  asset: MeterSnapshot
  settings?: Pick<CompanySettings, "defaultPmReminderDays">
  nowMs?: number
  calendar?: OperationalCalendar
}): Partial<Pick<PMSchedule, "nextDueHours" | "nextDueKm" | "nextRunAt" | "overdueStatus" | "dueSoonStatus" | "pmStatus">> {
  return calculatePMStatus(input)
}

export function detectMeterAnomaly(input: {
  previousValue?: number
  nextValue: number
  thresholdPct?: number
}): MeterAnomalyResult {
  const thresholdPct = input.thresholdPct ?? 30
  if (typeof input.previousValue !== "number") {
    return { anomalyFlag: false, thresholdPct }
  }

  const deltaFromPrevious = input.nextValue - input.previousValue
  if (deltaFromPrevious < 0) {
    return {
      anomalyFlag: true,
      reason: "METER_ROLLBACK",
      deltaFromPrevious,
      thresholdPct,
    }
  }

  if (input.previousValue <= 0) {
    return { anomalyFlag: false, deltaFromPrevious, thresholdPct }
  }

  const pctDelta = (deltaFromPrevious / input.previousValue) * 100
  if (pctDelta > thresholdPct) {
    return {
      anomalyFlag: true,
      reason: "DELTA_EXCEEDS_THRESHOLD",
      deltaFromPrevious,
      thresholdPct,
    }
  }

  return { anomalyFlag: false, deltaFromPrevious, thresholdPct }
}

export function applyMeterToAssetSnapshot(input: {
  asset: Pick<Asset, "operatingHours" | "odometer">
  kind: "operating_hours" | "odometer"
  value: number
}): MeterSnapshot {
  return {
    operatingHours:
      input.kind === "operating_hours"
        ? Math.max(input.asset.operatingHours ?? 0, input.value)
        : input.asset.operatingHours ?? 0,
    odometer:
      input.kind === "odometer"
        ? Math.max(input.asset.odometer ?? 0, input.value)
        : input.asset.odometer ?? 0,
  }
}
