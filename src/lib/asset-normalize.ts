import { Timestamp, type DocumentData } from "firebase/firestore"

import { ASSET_CATEGORY_IDS } from "@/lib/asset-categories"
import type { Asset, AssetStatus } from "@/models/firestore"

const STATUSES: AssetStatus[] = ["active", "maintenance", "retired"]

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

function asStatus(v: unknown): AssetStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v) ? (v as AssetStatus) : "active"
}

function normalizedCategorySlug(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (!s) return "other"
  if ((ASSET_CATEGORY_IDS as readonly string[]).includes(s)) return s
  const legacy: Record<string, string> = {
    hvac: "hvac",
    electrical: "electrical",
    mechanical: "mechanical",
    fleet: "fleet",
    it: "it",
    plumbing: "plumbing",
  }
  return legacy[s] ?? "other"
}

function asBrand(d: Record<string, unknown>): string {
  const b = d.brand
  if (typeof b === "string" && b.trim()) return b
  const m = d.manufacturer
  return typeof m === "string" ? m : ""
}

function asSerialNo(d: Record<string, unknown>): string {
  const sn = d.serialNo
  if (typeof sn === "string") return sn
  const legacy = d.serialNumber
  return typeof legacy === "string" ? legacy : ""
}

/**
 * Maps Firestore documents to the canonical Asset shape; supports legacy `code`/`name`, manufacturer/serialNumber.
 */
export function normalizeAsset(docId: string, data: DocumentData): Asset & { id: string } {
  const d = data as Record<string, unknown>
  const legacyCode = typeof d.code === "string" ? d.code : ""
  const legacyName = typeof d.name === "string" ? d.name : ""

  const createdAt =
    d.createdAt && typeof (d.createdAt as Timestamp).toMillis === "function"
      ? (d.createdAt as Timestamp)
      : Timestamp.now()
  const updatedAt =
    d.updatedAt && typeof (d.updatedAt as Timestamp).toMillis === "function"
      ? (d.updatedAt as Timestamp)
      : Timestamp.now()

  const brand = asBrand(d)
  const serialNo = asSerialNo(d)

  return {
    id: docId,
    createdAt,
    updatedAt,
    assetCode: typeof d.assetCode === "string" ? d.assetCode : legacyCode,
    assetName: typeof d.assetName === "string" ? d.assetName : legacyName,
    category: normalizedCategorySlug(d.category),
    brand,
    model: typeof d.model === "string" ? d.model : "",
    serialNo,
    plateNo: typeof d.plateNo === "string" ? d.plateNo : "",
    department: typeof d.department === "string" ? d.department : "",
    location: typeof d.location === "string" ? d.location : "",
    operatingHours: asNumber(d.operatingHours, 0),
    odometer: asNumber(d.odometer, 0),
    status: asStatus(d.status),
    purchaseDate:
      d.purchaseDate && typeof (d.purchaseDate as Timestamp).toMillis === "function"
        ? (d.purchaseDate as Timestamp)
        : undefined,
    warrantyExpiry:
      d.warrantyExpiry && typeof (d.warrantyExpiry as Timestamp).toMillis === "function"
        ? (d.warrantyExpiry as Timestamp)
        : undefined,
    assignedToUid: typeof d.assignedToUid === "string" ? d.assignedToUid : undefined,
    vendorName: typeof d.vendorName === "string" ? d.vendorName : undefined,
    sparePartsNote: typeof d.sparePartsNote === "string" ? d.sparePartsNote : undefined,
    documentsMeta: typeof d.documentsMeta === "string" ? d.documentsMeta : undefined,
    notes: typeof d.notes === "string" ? d.notes : "",
    imageUrl: typeof d.imageUrl === "string" ? d.imageUrl : "",
    qrPayload: typeof d.qrPayload === "string" ? d.qrPayload : undefined,
    equipmentClass: typeof d.equipmentClass === "string" ? d.equipmentClass : undefined,
    branch: typeof d.branch === "string" ? d.branch : undefined,
    businessUnit: typeof d.businessUnit === "string" ? d.businessUnit : undefined,
    latitude: typeof d.latitude === "number" ? d.latitude : undefined,
    longitude: typeof d.longitude === "number" ? d.longitude : undefined,
    maintenanceTemplateId:
      typeof d.maintenanceTemplateId === "string" ? d.maintenanceTemplateId : undefined,
    lastServiceCode:
      typeof d.lastServiceCode === "string" && /^[A-Z]$/.test(d.lastServiceCode)
        ? (d.lastServiceCode as Asset["lastServiceCode"])
        : undefined,
    lastServiceReading: typeof d.lastServiceReading === "number" ? d.lastServiceReading : undefined,
    manufacturer: typeof d.manufacturer === "string" ? d.manufacturer : brand || undefined,
    serialNumber: typeof d.serialNumber === "string" ? d.serialNumber : serialNo || undefined,
    installedAt:
      d.installedAt && typeof (d.installedAt as Timestamp).toMillis === "function"
        ? (d.installedAt as Timestamp)
        : undefined,
    lastServiceAt:
      d.lastServiceAt && typeof (d.lastServiceAt as Timestamp).toMillis === "function"
        ? (d.lastServiceAt as Timestamp)
        : undefined,
  }
}
