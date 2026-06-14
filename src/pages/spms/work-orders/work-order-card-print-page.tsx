import { Printer } from "lucide-react"
import { Navigate, useParams } from "react-router-dom"

import { WorkOrderCard } from "@/components/work-orders/work-order-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssetsQuery, useCompanySettingsQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"

export default function WorkOrderCardPrintPage() {
  const { workOrderId } = useParams<{ workOrderId: string }>()
  const workOrders = useWorkOrdersQuery()
  const assets = useAssetsQuery()
  const company = useCompanySettingsQuery()

  if (!workOrderId) return <Navigate to="/dashboard/work-orders" replace />

  const wo = workOrders.data?.find((w) => w.id === workOrderId)

  if (workOrders.isLoading || !workOrders.data) {
    return (
      <div className="mx-auto max-w-[700px] p-6">
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    )
  }

  if (!wo) {
    return <div className="p-10 text-center text-sm text-muted-foreground">لم يُعثر على أمر العمل.</div>
  }

  const asset = assets.data?.find((a) => a.id === wo.assetId)
  const publicUrl = `${window.location.origin}/dashboard/work-orders/${wo.id}`

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto mb-4 flex max-w-[680px] justify-end px-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          طباعة الكرت
        </Button>
      </div>
      <div className="print-area mx-auto max-w-[680px] overflow-hidden rounded-xl bg-white shadow-lg print:max-w-none print:rounded-none print:shadow-none">
        <WorkOrderCard
          workOrder={wo}
          asset={asset}
          companyNameAr={company.data?.companyNameAr}
          logoDataUrl={company.data?.logoDataUrl}
          publicUrl={publicUrl}
        />
      </div>
    </div>
  )
}
