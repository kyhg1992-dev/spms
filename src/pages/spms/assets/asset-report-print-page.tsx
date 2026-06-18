import { Printer } from "lucide-react"
import { useMemo } from "react"
import { Navigate, useParams } from "react-router-dom"
import type { Timestamp } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAssetsQuery,
  useCompanySettingsQuery,
  useMaintenanceTemplatesQuery,
  useMeterReadingsQuery,
  useUsersQuery,
  useWorkOrdersQuery,
} from "@/hooks/use-spms-data"
import { assetCategoryAr } from "@/lib/asset-categories"
import { equipmentClassLabel } from "@/lib/equipment-classes"
import { formatArDate, formatArDateTime } from "@/lib/format"
import { assetStatusAr, workOrderStatusAr } from "@/lib/labels-ar"
import { deriveNextServiceForAsset } from "@/lib/maintenance-next-service"
import type { MaintenanceSequenceTemplate } from "@/models/firestore"

function ts(v: Timestamp | undefined): number {
  return v && typeof v.toMillis === "function" ? v.toMillis() : 0
}

export default function AssetReportPrintPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const assets = useAssetsQuery()
  const company = useCompanySettingsQuery()
  const templates = useMaintenanceTemplatesQuery()
  const workOrders = useWorkOrdersQuery()
  const users = useUsersQuery()
  const readings = useMeterReadingsQuery(assetId)

  const asset = assets.data?.find((a) => a.id === assetId)
  const templatesById = useMemo(
    () =>
      new Map<string, MaintenanceSequenceTemplate & { id: string }>(
        (templates.data ?? []).map((t) => [t.id, t])
      ),
    [templates.data]
  )
  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  const history = useMemo(
    () =>
      (workOrders.data ?? [])
        .filter((w) => w.assetId === assetId)
        .sort((a, b) => ts(b.closedAt ?? b.updatedAt) - ts(a.closedAt ?? a.updatedAt)),
    [workOrders.data, assetId]
  )

  if (!assetId) return <Navigate to="/dashboard/assets" replace />
  if (assets.isLoading || !assets.data) {
    return <div className="mx-auto max-w-[800px] p-6"><Skeleton className="h-[600px] w-full rounded-xl" /></div>
  }
  if (!asset) return <div className="p-10 text-center text-sm text-muted-foreground">لم يُعثر على الأصل.</div>

  const next = asset ? deriveNextServiceForAsset({ asset, templatesById }) : null

  const fields: Array<[string, string]> = [
    ["رقم الأصل", asset.assetCode || "—"],
    ["اللوحة / الوحدة", asset.plateNo || "—"],
    ["التصنيف", asset.equipmentClass ? equipmentClassLabel(asset.equipmentClass) : assetCategoryAr(asset.category)],
    ["الحالة", assetStatusAr[asset.status] ?? asset.status],
    ["المصنّع / العلامة", asset.brand || "—"],
    ["الموديل", asset.model || "—"],
    ["الرقم التسلسلي", asset.serialNo || "—"],
    ["الموقع", asset.location || "—"],
    ["الفرع", asset.branch || "—"],
    ["وحدة العمل", asset.businessUnit || asset.department || "—"],
    ["ساعات التشغيل", asset.operatingHours.toLocaleString("en-US")],
    ["عداد الكيلومترات", asset.odometer.toLocaleString("en-US")],
    ["تاريخ الشراء", asset.purchaseDate ? formatArDate(asset.purchaseDate) : "—"],
    ["انتهاء الضمان", asset.warrantyExpiry ? formatArDate(asset.warrantyExpiry) : "—"],
    ["المورّد", asset.vendorName || "—"],
    ["قالب الصيانة", next?.templateName ?? "—"],
    ["الخدمة القادمة", next ? `${next.nextLabel} ${next.isDue ? "(مستحقة)" : `بعد ${Math.round(next.remainingUntilDue)}`}` : "—"],
    ["آخر خدمة", next?.lastLabel ?? asset.lastServiceCode ?? "—"],
  ]

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[800px] justify-end px-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> طباعة التقرير
        </Button>
      </div>

      <div dir="rtl" className="print-area mx-auto max-w-[800px] bg-white p-8 text-slate-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {company.data?.logoDataUrl ? (
              <img src={company.data.logoDataUrl} alt="" className="size-14 rounded border bg-white object-contain p-1" />
            ) : null}
            <div>
              <div className="text-lg font-bold">{company.data?.companyNameAr || "نظام الصيانة الوقائية"}</div>
              <div className="text-xs text-slate-500">تقرير الأصل المفصّل</div>
            </div>
          </div>
          <div className="text-left text-xs text-slate-500" dir="ltr">
            {formatArDateTime((company.data?.updatedAt ?? undefined))}
            <div>{asset.assetCode}</div>
          </div>
        </div>

        <h1 className="mb-4 text-xl font-bold">{asset.assetName}</h1>

        {/* Fields grid */}
        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {fields.map(([k, v]) => (
            <div key={k} className="border-b border-dashed border-slate-200 pb-1">
              <div className="text-[11px] text-slate-500">{k}</div>
              <div className="font-medium">{v}</div>
            </div>
          ))}
        </div>

        {/* Maintenance history */}
        <h2 className="mb-2 mt-6 border-b border-slate-300 pb-1 text-sm font-bold">سجل الصيانة ({history.length})</h2>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد أوامر عمل لهذا الأصل.</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-right">
                <th className="border border-slate-300 p-1.5">التاريخ</th>
                <th className="border border-slate-300 p-1.5">الإجراء / المستوى</th>
                <th className="border border-slate-300 p-1.5">الفنّي</th>
                <th className="border border-slate-300 p-1.5">المعتمِد</th>
                <th className="border border-slate-300 p-1.5">رقم الطلب</th>
                <th className="border border-slate-300 p-1.5">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {history.map((wo) => (
                <tr key={wo.id}>
                  <td className="border border-slate-300 p-1.5 tabular-nums">{formatArDate(wo.closedAt ?? wo.updatedAt)}</td>
                  <td className="border border-slate-300 p-1.5">{wo.serviceLevelNameAr ?? wo.serviceLevelCode ?? wo.title}</td>
                  <td className="border border-slate-300 p-1.5">{nameOf(wo.assignedTo ?? wo.assigneeId)}</td>
                  <td className="border border-slate-300 p-1.5">{nameOf(wo.approvedByUid)}</td>
                  <td className="border border-slate-300 p-1.5 tabular-nums" dir="ltr">{wo.externalRequestNo || "—"}</td>
                  <td className="border border-slate-300 p-1.5">{workOrderStatusAr[String(wo.status)] ?? wo.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Readings */}
        <h2 className="mb-2 mt-6 border-b border-slate-300 pb-1 text-sm font-bold">قراءات العدّاد ({(readings.data ?? []).length})</h2>
        {(readings.data ?? []).length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد قراءات.</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-right">
                <th className="border border-slate-300 p-1.5">النوع</th>
                <th className="border border-slate-300 p-1.5">القيمة</th>
                <th className="border border-slate-300 p-1.5">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {(readings.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="border border-slate-300 p-1.5">{r.kind === "odometer" ? "كم" : "ساعات"}</td>
                  <td className="border border-slate-300 p-1.5 tabular-nums">{r.value.toLocaleString("en-US")}</td>
                  <td className="border border-slate-300 p-1.5 tabular-nums">{formatArDateTime(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-8 border-t border-slate-300 pt-2 text-center text-[10px] text-slate-400">
          صُدِّر من نظام الصيانة الوقائية الذكي — SPMS
        </div>
      </div>
    </div>
  )
}
