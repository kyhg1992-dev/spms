import { QRCodeSVG } from "qrcode.react"

import { AssetBarcode } from "@/components/assets/asset-barcode"
import { actionColor, serviceLevelColor } from "@/lib/spms-colors"
import type { Asset, MaintenanceActionCode, WorkOrder } from "@/models/firestore"

const ACTION_AR: Record<MaintenanceActionCode, string> = {
  REPLACE: "استبدال",
  CLEAN: "تنظيف",
  CHECK: "فحص",
  DRAIN: "تصريف",
  GREASE: "تشحيم",
  ADJUST: "ضبط",
  WASH: "غسيل",
  REFILL: "تعبئة",
}

const issueDateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  calendar: "gregory",
})

type Props = {
  workOrder: WorkOrder & { id: string }
  asset?: Asset & { id: string }
  companyNameAr?: string
  logoDataUrl?: string
  publicUrl: string
}

/**
 * Printable work-order card — company logo, asset identity, the colored service
 * task checklist (bilingual, with item codes / quantities / part numbers), and
 * signature lines. Always on white for clean printing/scanning.
 */
export function WorkOrderCard({ workOrder, asset, companyNameAr, logoDataUrl, publicUrl }: Props) {
  const tasks = workOrder.serviceTasks ?? []
  const level = workOrder.serviceLevelCode
  const c = level ? serviceLevelColor(level) : null

  return (
    <div dir="rtl" className="mx-auto w-full max-w-[680px] bg-white p-6 text-slate-900">
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
        <div className="flex items-center gap-3">
          {logoDataUrl ? <img src={logoDataUrl} alt="" className="size-12 rounded object-contain" /> : null}
          <div>
            <div className="text-base font-bold">{companyNameAr || "نظام الصيانة الوقائية"}</div>
            <div className="text-[11px] text-slate-500">SPMS · أمر صيانة</div>
          </div>
        </div>
        <div className="text-left text-[11px] text-slate-500">
          <div>رقم الأمر: <span className="font-mono text-slate-700">{workOrder.id.slice(0, 8)}</span></div>
          <div>التاريخ: <span className="font-medium text-slate-700">{issueDateFmt.format(new Date())}</span></div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold">{workOrder.title}</div>
          <div className="text-[12px] text-slate-600">
            {asset ? `${asset.assetName} · ${asset.assetCode}` : workOrder.assetId}
            {asset?.plateNo && asset.plateNo !== "—" ? ` · لوحة ${asset.plateNo}` : ""}
          </div>
        </div>
        {level && c ? (
          <div className="text-center text-white" style={{ backgroundColor: c.solid, borderRadius: 8, padding: "6px 12px" }}>
            <div className="text-lg font-bold leading-none">{level}</div>
            <div className="text-[9px] opacity-90">{workOrder.serviceLevelNameAr ?? "المستوى"}</div>
          </div>
        ) : null}
      </div>

      {tasks.length ? (
        <table className="mt-4 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b-2 border-slate-300 text-slate-500">
              <th className="w-7 p-1.5 text-center font-medium">✓</th>
              <th className="p-1.5 text-start font-medium">الوصف / Description</th>
              <th className="w-24 p-1.5 text-start font-medium">Item Code</th>
              <th className="w-12 p-1.5 text-center font-medium">كمية</th>
              <th className="w-20 p-1.5 text-start font-medium">الإجراء</th>
              <th className="w-24 p-1.5 text-start font-medium">رقم القطعة</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => {
              const ac = actionColor(t.action)
              return (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-1.5 text-center"><span className="inline-block size-3.5 rounded-sm border border-slate-400" /></td>
                  <td className="p-1.5">
                    <div className="font-medium">{t.descAr}</div>
                    {t.descEn ? <div className="text-[10px] text-slate-500" dir="ltr">{t.descEn}</div> : null}
                  </td>
                  <td className="p-1.5 font-mono text-[10px] text-slate-600" dir="ltr">{t.itemCode ?? "—"}</td>
                  <td className="p-1.5 text-center font-medium">{t.qty ?? "—"}</td>
                  <td className="p-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: ac.bg, color: ac.fg }}>
                      {ACTION_AR[t.action] ?? t.action}
                    </span>
                  </td>
                  <td className="p-1.5 font-mono text-[10px] text-slate-600" dir="ltr">{t.partNo ?? "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-[12px] text-slate-500">لا توجد مهام مرتبطة بهذا الأمر.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-6 text-[12px]">
        <div className="border-t border-slate-300 pt-2">
          <div className="text-slate-500">الفنّي المنفّذ</div>
          <div className="mt-6 border-b border-dashed border-slate-400" />
          <div className="mt-1 text-[10px] text-slate-400">الاسم · التوقيع · التاريخ</div>
        </div>
        <div className="border-t border-slate-300 pt-2">
          <div className="text-slate-500">اعتماد المشرف</div>
          <div className="mt-6 border-b border-dashed border-slate-400" />
          <div className="mt-1 text-[10px] text-slate-400">الاسم · التوقيع · التاريخ</div>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between border-t border-slate-200 pt-4">
        {asset?.assetCode ? <AssetBarcode value={asset.assetCode} height={42} /> : <span />}
        <div className="flex flex-col items-center gap-1">
          <QRCodeSVG value={publicUrl} size={84} bgColor="#ffffff" fgColor="#0f172a" level="M" />
          <span className="text-[9px] text-slate-400">امسح للتفاصيل</span>
        </div>
      </div>
    </div>
  )
}
