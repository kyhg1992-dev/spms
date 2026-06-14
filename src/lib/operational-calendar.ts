import { Timestamp } from "firebase/firestore"

import type { CompanySettings } from "@/models/firestore"

export type OperationalCalendar = {
  weekendDays: number[]
  officialHolidays: string[]
  shutdownPeriods: Array<{ from: string; to: string; reason?: string }>
  quietHours?: { start: string; end: string }
  workshopOperatingHours?: { start: string; end: string }
}

export type NotificationTimingDecision = {
  suppressNow: boolean
  reason?: "QUIET_HOURS" | "SHUTDOWN_PERIOD"
  nextAllowedAt?: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_OPERATIONAL_CALENDAR: OperationalCalendar = {
  weekendDays: [5, 6],
  officialHolidays: [],
  shutdownPeriods: [],
  quietHours: { start: "22:00", end: "06:00" },
  workshopOperatingHours: { start: "07:00", end: "17:00" },
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function minutesOfDay(value: string | undefined): number | null {
  if (!value) return null
  const [hh, mm] = value.split(":").map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

function currentMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function operationalCalendarFromSettings(
  settings?: Partial<CompanySettings> | null
): OperationalCalendar {
  return {
    weekendDays: settings?.weekendDays?.length ? settings.weekendDays : DEFAULT_OPERATIONAL_CALENDAR.weekendDays,
    officialHolidays: settings?.officialHolidays ?? DEFAULT_OPERATIONAL_CALENDAR.officialHolidays,
    shutdownPeriods: settings?.shutdownPeriods ?? DEFAULT_OPERATIONAL_CALENDAR.shutdownPeriods,
    quietHours: settings?.quietHours ?? DEFAULT_OPERATIONAL_CALENDAR.quietHours,
    workshopOperatingHours: settings?.workshopOperatingHours ?? DEFAULT_OPERATIONAL_CALENDAR.workshopOperatingHours,
  }
}

export function isShutdownDay(date: Date, calendar: OperationalCalendar): boolean {
  const key = dateKey(date)
  return calendar.shutdownPeriods.some((period) => key >= period.from && key <= period.to)
}

export function isOperationalWorkingDay(date: Date, calendar: OperationalCalendar): boolean {
  if (calendar.weekendDays.includes(date.getDay())) return false
  if (calendar.officialHolidays.includes(dateKey(date))) return false
  if (isShutdownDay(date, calendar)) return false
  return true
}

export function nextOperationalDate(input: {
  from: Date
  calendar?: OperationalCalendar
  maxLookaheadDays?: number
}): Date {
  const calendar = input.calendar ?? DEFAULT_OPERATIONAL_CALENDAR
  const maxLookaheadDays = input.maxLookaheadDays ?? 30
  const candidate = new Date(input.from)

  for (let i = 0; i <= maxLookaheadDays; i += 1) {
    if (isOperationalWorkingDay(candidate, calendar)) {
      const start = minutesOfDay(calendar.workshopOperatingHours?.start)
      if (start !== null) {
        candidate.setHours(Math.floor(start / 60), start % 60, 0, 0)
      }
      return candidate
    }
    candidate.setTime(candidate.getTime() + DAY_MS)
  }

  return input.from
}

export function nextOperationalTimestamp(input: {
  from: Timestamp
  calendar?: OperationalCalendar
}): Timestamp {
  return Timestamp.fromDate(nextOperationalDate({ from: input.from.toDate(), calendar: input.calendar }))
}

export function notificationTimingDecision(input: {
  now?: Date
  calendar?: OperationalCalendar
  priority?: "INFO" | "WARNING" | "CRITICAL"
}): NotificationTimingDecision {
  if (input.priority === "CRITICAL") return { suppressNow: false }
  const now = input.now ?? new Date()
  const calendar = input.calendar ?? DEFAULT_OPERATIONAL_CALENDAR
  if (isShutdownDay(now, calendar)) {
    return {
      suppressNow: true,
      reason: "SHUTDOWN_PERIOD",
      nextAllowedAt: nextOperationalDate({ from: new Date(now.getTime() + DAY_MS), calendar }),
    }
  }

  const quietStart = minutesOfDay(calendar.quietHours?.start)
  const quietEnd = minutesOfDay(calendar.quietHours?.end)
  if (quietStart === null || quietEnd === null) return { suppressNow: false }

  const current = currentMinutes(now)
  const inQuietHours =
    quietStart < quietEnd
      ? current >= quietStart && current < quietEnd
      : current >= quietStart || current < quietEnd

  if (!inQuietHours) return { suppressNow: false }

  const next = new Date(now)
  next.setHours(Math.floor(quietEnd / 60), quietEnd % 60, 0, 0)
  if (next <= now) next.setTime(next.getTime() + DAY_MS)
  return { suppressNow: true, reason: "QUIET_HOURS", nextAllowedAt: nextOperationalDate({ from: next, calendar }) }
}
