import type { Asset, PMSchedule, WorkOrder, WorkOrderStatus } from "@/models/firestore"

export type ReportingDateRange = {
  fromMs?: number
  toMs?: number
}

export type ReportingFilters = {
  dateRange?: ReportingDateRange
  assetId?: string
  siteOrWorkshop?: string
  technicianUid?: string
  pmServiceType?: PMSchedule["serviceType"]
  workOrderStatus?: WorkOrderStatus
}

export type ReportingDataset = {
  assets: Array<Asset & { id: string }>
  workOrders: Array<WorkOrder & { id: string }>
  pmSchedules: Array<PMSchedule & { id: string }>
}

export type CountBucket = {
  key: string
  count: number
}

function inDateRange(valueMs: number, range: ReportingDateRange | undefined): boolean {
  if (!range || !valueMs) return true
  if (typeof range.fromMs === "number" && valueMs < range.fromMs) return false
  if (typeof range.toMs === "number" && valueMs > range.toMs) return false
  return true
}

function workOrderDateMs(workOrder: WorkOrder): number {
  return workOrder.updatedAt?.toMillis?.() ?? workOrder.createdAt?.toMillis?.() ?? 0
}

function pmDateMs(schedule: PMSchedule): number {
  return schedule.nextRunAt?.toMillis?.() ?? schedule.updatedAt?.toMillis?.() ?? 0
}

function assetMatchesSite(asset: Asset | undefined, siteOrWorkshop: string | undefined): boolean {
  if (!siteOrWorkshop?.trim()) return true
  const needle = siteOrWorkshop.trim().toLowerCase()
  return [asset?.department, asset?.location, asset?.category]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle))
}

export function filterReportingDataset(
  dataset: ReportingDataset,
  filters: ReportingFilters
): ReportingDataset {
  const assetById = new Map(dataset.assets.map((asset) => [asset.id, asset]))

  const assets = dataset.assets.filter((asset) => {
    if (filters.assetId && asset.id !== filters.assetId) return false
    return assetMatchesSite(asset, filters.siteOrWorkshop)
  })
  const visibleAssetIds = new Set(assets.map((asset) => asset.id))

  const workOrders = dataset.workOrders.filter((workOrder) => {
    if (filters.assetId && workOrder.assetId !== filters.assetId) return false
    if (!visibleAssetIds.has(workOrder.assetId)) return false
    if (!assetMatchesSite(assetById.get(workOrder.assetId), filters.siteOrWorkshop)) return false
    if (filters.technicianUid && (workOrder.assignedTo ?? workOrder.assigneeId) !== filters.technicianUid) return false
    if (filters.workOrderStatus && workOrder.status !== filters.workOrderStatus) return false
    return inDateRange(workOrderDateMs(workOrder), filters.dateRange)
  })

  const pmSchedules = dataset.pmSchedules.filter((schedule) => {
    if (filters.assetId && schedule.assetId !== filters.assetId) return false
    if (!visibleAssetIds.has(schedule.assetId)) return false
    if (!assetMatchesSite(assetById.get(schedule.assetId), filters.siteOrWorkshop)) return false
    if (filters.pmServiceType && schedule.serviceType !== filters.pmServiceType) return false
    return inDateRange(pmDateMs(schedule), filters.dateRange)
  })

  return { assets, workOrders, pmSchedules }
}

export function countBy<T>(rows: T[], keySelector: (row: T) => string | undefined): CountBucket[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = keySelector(row)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

export function sumBy<T>(rows: T[], selector: (row: T) => number | undefined): number {
  return rows.reduce((sum, row) => sum + (selector(row) ?? 0), 0)
}
