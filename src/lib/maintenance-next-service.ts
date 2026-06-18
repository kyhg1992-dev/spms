import type { Asset, MaintenanceSequenceTemplate, PMSchedule } from "@/models/firestore"

import {
  computeNextCode,
  occurrenceLabelForIndex,
  type NextCodeResult,
} from "@/lib/maintenance-sequence"

export type NextServiceView = NextCodeResult & {
  templateId: string
  templateName: string
  currentReading: number
  meterKind: MaintenanceSequenceTemplate["meterKind"]
  /** Display label of the last performed service (disambiguates repeats), or null. */
  lastLabel: string | null
}

/**
 * Derive the "next service" view for a PM schedule that is bound to a sequence
 * template, using the live asset meter reading. Returns `null` when the schedule
 * has no template, the template is missing, or the asset is unknown — so the UI
 * can simply fall back to showing nothing.
 */
export function deriveNextServiceForSchedule(input: {
  schedule: Pick<PMSchedule, "maintenanceTemplateId" | "serviceType" | "lastServiceReading">
  templatesById: Map<string, MaintenanceSequenceTemplate & { id: string }>
  asset?: Pick<Asset, "operatingHours" | "odometer">
}): NextServiceView | null {
  const templateId = input.schedule.maintenanceTemplateId
  if (!templateId) return null

  const template = input.templatesById.get(templateId)
  if (!template || template.sequence.length === 0 || !(template.stepInterval > 0)) return null
  if (!input.asset) return null

  const currentReading =
    template.meterKind === "odometer"
      ? input.asset.odometer ?? 0
      : input.asset.operatingHours ?? 0
  const lastReading = input.schedule.lastServiceReading ?? currentReading

  const result = computeNextCode(
    template,
    input.schedule.serviceType,
    currentReading,
    lastReading
  )

  return {
    ...result,
    templateId,
    templateName: template.name,
    currentReading,
    meterKind: template.meterKind,
    lastLabel: null,
  }
}

/**
 * Derive the next service for an asset directly from its assigned template and
 * recorded last-service position (continuation). Returns `null` when the asset
 * has no template assigned.
 */
export function deriveNextServiceForAsset(input: {
  asset: Asset & { id: string }
  templatesById: Map<string, MaintenanceSequenceTemplate & { id: string }>
}): NextServiceView | null {
  const templateId = input.asset.maintenanceTemplateId
  if (!templateId) return null
  const template = input.templatesById.get(templateId)
  if (!template || template.sequence.length === 0 || !(template.stepInterval > 0)) return null

  const currentReading =
    template.meterKind === "odometer"
      ? input.asset.odometer ?? 0
      : input.asset.operatingHours ?? 0
  const lastReading = input.asset.lastServiceReading ?? currentReading

  const result = computeNextCode(
    template,
    input.asset.lastServiceCode ?? null,
    currentReading,
    lastReading,
    input.asset.lastServiceIndex ?? null
  )

  const lastLabel =
    input.asset.lastServiceIndex != null
      ? occurrenceLabelForIndex(template.sequence, input.asset.lastServiceIndex)
      : input.asset.lastServiceCode ?? null

  return {
    ...result,
    templateId,
    templateName: template.name,
    currentReading,
    meterKind: template.meterKind,
    lastLabel,
  }
}
