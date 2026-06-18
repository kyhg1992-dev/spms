import { QRCodeSVG } from "qrcode.react"

import { AssetBarcode } from "@/components/assets/asset-barcode"
import { assetCategoryAr } from "@/lib/asset-categories"
import { assetStatusAr, pmServiceTypeAr } from "@/lib/labels-ar"
import type { Asset, PMSchedule } from "@/models/firestore"

const issueDateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  calendar: "gregory",
})

type MaintenanceCardProps = {
  asset: Asset & { id: string }
  companyNameAr?: string
  logoDataUrl?: string
  pmSchedules?: (PMSchedule & { id: string })[]
  publicUrl: string
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-200 py-1.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-[13px] font-medium text-slate-900">{value || "—"}</span>
    </div>
  )
}

/**
 * Printable maintenance card (كرت الصيانة). Always rendered on a white surface
 * with dark text so it prints cleanly regardless of app theme. Combines the
 * company logo, asset identity, scheduled service codes, barcode and QR.
 */
export function MaintenanceCard({
  asset,
  companyNameAr,
  logoDataUrl,
  pmSchedules,
  publicUrl,
}: MaintenanceCardProps) {
  const assetPm = (pmSchedules ?? []).filter((p) => p.assetId === asset.id)

  return (
    <div dir="rtl" className="mx-auto w-full max-w-[640px] bg-white p-6 text-slate-900">
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
        <div className="flex items-center gap-3">
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="size-12 rounded object-contain" />
          ) : null}
          <div>
            <div className="text-base font-bold">{companyNameAr || "نظام الصيانة الوقائية"}</div>
            <div className="text-[11px] text-slate-500">SPMS · كرت صيانة وقائية</div>
          </div>
        </div>
        <div className="text-left text-[11px] text-slate-500">
          <div>تاريخ الإصدار</div>
          <div className="font-medium text-slate-700">{issueDateFmt.format(new Date())}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-0">
        <Field label="رمز الأصل" value={asset.assetCode} />
        <Field label="رقم اللوحة" value={asset.plateNo} />
        <Field label="التسمية" value={asset.assetName} />
        <Field label="التصنيف" value={assetCategoryAr(asset.category)} />
        <Field label="العلامة / الموديل" value={[asset.brand, asset.model].filter(Boolean).join(" / ")} />
        <Field label="الرقم التسلسلي" value={asset.serialNo} />
        <Field label="القطاع / الإدارة" value={asset.department} />
        <Field label="الموقع" value={asset.location} />
        <Field label="ساعات التشغيل" value={`${asset.operatingHours ?? 0}`} />
        <Field label="عدّاد المسافة (كم)" value={`${asset.odometer ?? 0}`} />
        <Field label="الحالة" value={assetStatusAr[asset.status] ?? asset.status} />
        <Field label="المورّد" value={asset.vendorName ?? ""} />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-bold">برامج الصيانة الوقائية</div>
        {assetPm.length === 0 ? (
          <p className="text-[11px] text-slate-500">لا توجد برامج صيانة مرتبطة.</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-300 text-slate-500">
                <th className="py-1 text-right font-medium">البرنامج</th>
                <th className="py-1 text-right font-medium">الرمز</th>
                <th className="py-1 text-right font-medium">التكرار</th>
              </tr>
            </thead>
            <tbody>
              {assetPm.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1">{p.title}</td>
                  <td className="py-1 font-medium">{pmServiceTypeAr[p.serviceType] ?? p.serviceType}</td>
                  <td className="py-1">{`كل ${p.frequencyDays} يوم`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between border-t border-slate-200 pt-4">
        <AssetBarcode value={asset.assetCode} height={44} />
        <div className="flex flex-col items-center gap-1">
          <QRCodeSVG value={publicUrl} size={92} bgColor="#ffffff" fgColor="#0f172a" level="M" />
          <span className="text-[9px] text-slate-400">امسح للتفاصيل</span>
        </div>
      </div>
    </div>
  )
}
