import type { Asset, PMSchedule, WorkOrder } from "@/models/firestore"

export type OperationalHealthCheck = {
  key: string
  status: "OK" | "WARNING" | "CRITICAL"
  labelAr: string
  labelEn: string
  count: number
}

export function buildOperationalHealthChecks(input: {
  assets: Array<Asset & { id: string }>
  workOrders: Array<WorkOrder & { id: string }>
  pmSchedules: Array<PMSchedule & { id: string }>
  nowMs?: number
}): OperationalHealthCheck[] {
  const nowMs = input.nowMs ?? Date.now()
  const orphanPMWorkOrders = input.workOrders.filter(
    (workOrder) => workOrder.sourceType === "PM" && !workOrder.pmScheduleId
  ).length
  const overduePM = input.pmSchedules.filter(
    (schedule) => schedule.isActive && schedule.nextRunAt?.toMillis?.() < nowMs
  ).length
  const missingAssetWorkOrders = input.workOrders.filter(
    (workOrder) => !input.assets.some((asset) => asset.id === workOrder.assetId)
  ).length

  return [
    {
      key: "orphan_pm_work_orders",
      status: orphanPMWorkOrders > 0 ? "WARNING" : "OK",
      labelAr: "أوامر PM بلا رابط خطة",
      labelEn: "PM work orders missing schedule links",
      count: orphanPMWorkOrders,
    },
    {
      key: "overdue_pm",
      status: overduePM > 0 ? "WARNING" : "OK",
      labelAr: "خطط PM متأخرة",
      labelEn: "Overdue PM schedules",
      count: overduePM,
    },
    {
      key: "missing_asset_work_orders",
      status: missingAssetWorkOrders > 0 ? "CRITICAL" : "OK",
      labelAr: "أوامر عمل بأصول مفقودة",
      labelEn: "Work orders with missing assets",
      count: missingAssetWorkOrders,
    },
  ]
}
