import { Printer } from "lucide-react"
import { useMemo } from "react"
import { Navigate, useParams } from "react-router-dom"
import { QRCodeSVG } from "qrcode.react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssetsQuery, useCompanySettingsQuery, useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import { deriveNextServiceForAsset } from "@/lib/maintenance-next-service"
import { serviceLevelColor } from "@/lib/spms-colors"
import type { MaintenanceSequenceTemplate } from "@/models/firestore"

const TRIGGER_UNIT: Record<string, string> = { hours: "ساعة", km: "كم", time: "يوم" }

export default function AssetStickerPrintPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const assets = useAssetsQuery()
  const templates = useMaintenanceTemplatesQuery()
  const company = useCompanySettingsQuery()

  const templatesById = useMemo(
    () =>
      new Map<string, MaintenanceSequenceTemplate & { id: string }>(
        (templates.data ?? []).map((t) => [t.id, t])
      ),
    [templates.data]
  )

  if (!assetId) return <Navigate to="/dashboard/assets" replace />
  const asset = assets.data?.find((a) => a.id === assetId)

  if (assets.isLoading || !assets.data) {
    return <div className="mx-auto max-w-sm p-6"><Skeleton className="h-48 w-full rounded-xl" /></div>
  }
  if (!asset) return <div className="p-10 text-center text-sm text-muted-foreground">لم يُعثر على الأصل.</div>

  const next = deriveNextServiceForAsset({ asset, templatesById })
  const template = asset.maintenanceTemplateId ? templatesById.get(asset.maintenanceTemplateId) : undefined
  const unit = TRIGGER_UNIT[template?.triggerMode ?? "hours"]
  const nextAt = next ? Math.round(next.currentReading + next.remainingUntilDue) : 0
  const c = next ? serviceLevelColor(next.nextCode) : null
  const scanUrl = `${window.location.origin}/scan/${asset.id}`

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto mb-4 flex max-w-[360px] justify-end px-2 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          طباعة الاستيكر
        </Button>
      </div>
      <div className="print-area mx-auto w-[360px] overflow-hidden rounded-xl bg-white shadow-lg print:shadow-none">
        <div dir="rtl" className="border-2 border-slate-900 p-3 text-slate-900">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
            <span className="text-[11px] font-bold">{company.data?.companyNameAr || "الصيانة الوقائية"}</span>
            <span className="text-[9px] text-slate-500">الموعد القادم للصيانة</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {c ? (
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg text-white" style={{ backgroundColor: c.solid }}>
                <span className="text-2xl font-bold leading-none">{next!.nextLabel}</span>
                <span className="text-[8px] opacity-90">المستوى</span>
              </div>
            ) : null}
            <div className="flex-1">
              <div className="text-[15px] font-bold leading-tight">{asset.assetName}</div>
              <div className="text-[11px] text-slate-600" dir="ltr">{asset.assetCode} · {asset.plateNo}</div>
              {next ? (
                <div className="mt-1 text-[12px] font-medium">
                  عند {nextAt.toLocaleString("ar-SA")} {unit}
                  {next.isDue ? <span className="text-red-700"> · مستحقة الآن</span> : null}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-slate-500">لا قالب مرتبط</div>
              )}
            </div>
            <QRCodeSVG value={scanUrl} size={56} bgColor="#ffffff" fgColor="#0f172a" level="M" />
          </div>
          <div className="mt-2 border-t border-slate-200 pt-1.5 text-[9px] text-slate-500">
            آخر صيانة: {next?.lastLabel ?? asset.lastServiceCode ?? "—"}
            {asset.lastServiceReading != null ? ` عند ${Math.round(asset.lastServiceReading)}` : ""} · امسح الرمز للتفاصيل
          </div>
        </div>
      </div>
    </div>
  )
}
