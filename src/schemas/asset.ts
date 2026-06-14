import { z } from "zod"

import { ASSET_CATEGORY_IDS } from "@/lib/asset-categories"

export const assetStatusSchema = z.enum(["active", "maintenance", "retired"])

export const assetFormSchema = z.object({
  assetCode: z.string().trim().min(1, "رمز الأصل مطلوب").max(64),
  assetName: z.string().trim().min(1, "اسم الأصل مطلوب").max(200),
  category: z.enum(ASSET_CATEGORY_IDS, { message: "اختر فئة الأصل" }),
  brand: z.string().trim().max(120),
  model: z.string().trim().max(120),
  serialNo: z.string().trim().max(120),
  plateNo: z.string().trim().min(1, "رقم اللوحة مطلوب").max(32),
  department: z.string().trim().max(120),
  location: z.string().trim().min(1, "الموقع مطلوب").max(200),
  operatingHours: z.number().min(0, "لا يمكن أن تكون سالبة").max(1_000_000_000),
  odometer: z.number().min(0, "لا يمكن أن تكون سالبة").max(1_000_000_000),
  status: assetStatusSchema,
  purchaseDate: z.string(),
  warrantyExpiry: z.string(),
  assignedToUid: z.string(),
  vendorName: z.string().trim().max(160),
  sparePartsNote: z.string().trim().max(1200),
  documentsMeta: z.string().trim().max(1200),
  qrPayload: z.string().trim().max(2000),
  maintenanceTemplateId: z.string().trim().max(80),
  lastServiceCode: z.string().trim().max(2),
  lastServiceReading: z.number().min(0, "لا يمكن أن تكون سالبة").max(1_000_000_000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(5000),
})

export type AssetFormInput = z.infer<typeof assetFormSchema>
