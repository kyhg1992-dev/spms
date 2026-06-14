import type {
  Asset,
  MaintenanceSequenceTemplate,
  MaintenanceServiceCode,
  UserRole,
} from "@/models/firestore"

import { normalizeMaintenanceTemplate } from "@/lib/maintenance-sequence-normalize"
import {
  computeNextCode,
  registerMaintenanceTemplates,
  type NextCodeResult,
} from "@/lib/maintenance-sequence"
import { getOne, listMany, type AsyncState } from "@/services/firestore/crud"
import { canAccess } from "@/services/firestore/permissions"

const COLLECTION = "maintenanceTemplates"

function forbidden<T>(): AsyncState<T> {
  return { loading: false, data: null, error: "Permission denied" }
}

function ok<T>(data: T): AsyncState<T> {
  return { loading: false, data, error: null }
}

function fail<T>(error: string): AsyncState<T> {
  return { loading: false, data: null, error }
}

/**
 * Load every maintenance template from Firestore, normalize it, and register it
 * with the in-memory engine so `getNextCode(templateId, ...)` can resolve ids.
 * Call this once on app/session start (or when templates change).
 */
export async function loadMaintenanceTemplates(
  role: UserRole
): Promise<AsyncState<Array<MaintenanceSequenceTemplate & { id: string }>>> {
  if (!canAccess(role, COLLECTION, "read")) {
    return forbidden<Array<MaintenanceSequenceTemplate & { id: string }>>()
  }

  const raw = await listMany<Record<string, unknown>>(COLLECTION, { orderByField: "templateCode", orderDirection: "asc" })
  if (raw.error || !raw.data) {
    return fail<Array<MaintenanceSequenceTemplate & { id: string }>>(raw.error ?? "Failed to load templates")
  }

  const templates = raw.data.map((doc) => normalizeMaintenanceTemplate(doc.id, doc))
  registerMaintenanceTemplates(templates)
  return ok(templates)
}

/** Fetch and normalize a single template by id (also registers it). */
export async function getMaintenanceTemplateById(
  role: UserRole,
  templateId: string
): Promise<AsyncState<MaintenanceSequenceTemplate & { id: string }>> {
  if (!canAccess(role, COLLECTION, "read")) {
    return forbidden<MaintenanceSequenceTemplate & { id: string }>()
  }

  const raw = await getOne<Record<string, unknown>>(COLLECTION, templateId)
  if (raw.error || !raw.data) {
    return fail<MaintenanceSequenceTemplate & { id: string }>(raw.error ?? "Template not found")
  }

  const template = normalizeMaintenanceTemplate(raw.data.id, raw.data)
  registerMaintenanceTemplates([template])
  return ok(template)
}

/**
 * Resolve the next service code for an asset straight from Firestore.
 *
 * Loads the template and the asset, reads the asset's current meter value for the
 * template's `meterKind`, then delegates to the pure engine. `lastCode` and
 * `lastReading` describe the most recent service performed (supply `null`/`0`
 * for a brand-new asset with no history).
 */
export async function resolveNextCodeForAsset(
  role: UserRole,
  input: {
    templateId: string
    assetId: string
    lastCode: MaintenanceServiceCode | null
    lastReading: number
  }
): Promise<AsyncState<NextCodeResult & { templateId: string; assetId: string; currentReading: number }>> {
  if (!canAccess(role, COLLECTION, "read") || !canAccess(role, "assets", "read")) {
    return forbidden()
  }

  const templateState = await getMaintenanceTemplateById(role, input.templateId)
  if (templateState.error || !templateState.data) {
    return fail(templateState.error ?? "Template not found")
  }

  const assetState = await getOne<Asset>("assets", input.assetId)
  if (assetState.error || !assetState.data) {
    return fail(assetState.error ?? "Asset not found")
  }

  const template = templateState.data
  const asset = assetState.data
  const currentReading =
    template.meterKind === "odometer" ? asset.odometer ?? 0 : asset.operatingHours ?? 0

  try {
    const result = computeNextCode(template, input.lastCode, currentReading, input.lastReading)
    return ok({ ...result, templateId: input.templateId, assetId: input.assetId, currentReading })
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to compute next code")
  }
}
