import { Printer } from "lucide-react"
import { Navigate, useParams } from "react-router-dom"

import { MaintenanceCard } from "@/components/assets/maintenance-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssetsQuery, useCompanySettingsQuery, usePMSchedulesQuery } from "@/hooks/use-spms-data"

export default function AssetCardPrintPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const assets = useAssetsQuery()
  const company = useCompanySettingsQuery()
  const pm = usePMSchedulesQuery()

  if (!assetId) return <Navigate to="/dashboard/assets" replace />

  const asset = assets.data?.find((a) => a.id === assetId)

  if (assets.isLoading || !assets.data) {
    return (
      <div className="mx-auto max-w-[680px] p-6">
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    )
  }

  if (!asset) {
    return <div className="p-10 text-center text-sm text-muted-foreground">لم يُعثر على الأصل.</div>
  }

  const publicUrl = `${window.location.origin}/scan/${asset.id}`

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto mb-4 flex max-w-[640px] justify-end px-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          طباعة الكرت
        </Button>
      </div>
      <div className="print-area mx-auto max-w-[640px] overflow-hidden rounded-xl bg-white shadow-lg print:max-w-none print:rounded-none print:shadow-none">
        <MaintenanceCard
          asset={asset}
          companyNameAr={company.data?.companyNameAr}
          logoDataUrl={company.data?.logoDataUrl}
          pmSchedules={pm.data ?? []}
          publicUrl={publicUrl}
        />
      </div>
    </div>
  )
}
