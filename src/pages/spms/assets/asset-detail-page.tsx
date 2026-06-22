import { ArrowRight, FileText, ImageIcon, Printer, QrCode, Sticker, Wrench } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { AssetBarcode } from "@/components/assets/asset-barcode"
import { AssetDeleteDialog } from "@/components/assets/asset-delete-dialog"
import { AssetFormDialog } from "@/components/assets/asset-form-dialog"
import { AssetMaintenanceHistory } from "@/components/assets/asset-maintenance-history"
import { AssetMeterPanel } from "@/components/assets/asset-meter-panel"
import { RequestNoPromptDialog } from "@/components/work-orders/request-no-prompt-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery, useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import { assetCategoryAr } from "@/lib/asset-categories"
import { deriveNextServiceForAsset } from "@/lib/maintenance-next-service"
import { serviceLevelColor } from "@/lib/spms-colors"
import type { MaintenanceSequenceTemplate } from "@/models/firestore"
import { formatArDate, formatArDateTime } from "@/lib/format"
import { assetStatusAr } from "@/lib/labels-ar"
import type { Asset } from "@/models/firestore"
import { generateAssetServiceWorkOrder } from "@/services/firestore/spms-service"
import { canAccess } from "@/services/firestore/permissions"

type AssetRow = Asset & { id: string }

function assetPublicUrl(assetId: string): string {
  // QR/barcode resolve to the focused scan page (next service, last service, reading entry).
  return `${window.location.origin}/scan/${assetId}`
}

export default function AssetDetailPage() {
  const navigate = useNavigate()
  const { assetId } = useParams<{ assetId: string }>()
  const { data, isLoading } = useAssetsQuery()
  const { spmsRole, user } = useAuth()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [reqPromptId, setReqPromptId] = useState<string | null>(null)

  const templates = useMaintenanceTemplatesQuery()
  const asset = useMemo(() => data?.find((a) => a.id === assetId) as AssetRow | undefined, [data, assetId])
  const templatesById = useMemo(
    () =>
      new Map<string, MaintenanceSequenceTemplate & { id: string }>(
        (templates.data ?? []).map((t) => [t.id, t])
      ),
    [templates.data]
  )
  const nextService = useMemo(
    () => (asset ? deriveNextServiceForAsset({ asset, templatesById }) : null),
    [asset, templatesById]
  )

  const canUpdate = spmsRole && canAccess(spmsRole, "assets", "update")
  const canDelete = spmsRole && canAccess(spmsRole, "assets", "delete")
  const canGenerate = spmsRole && canAccess(spmsRole, "workOrders", "create")

  async function generateService() {
    if (!asset || !spmsRole || !user?.uid) return
    setGenBusy(true)
    try {
      const res = await generateAssetServiceWorkOrder(spmsRole, { assetId: asset.id, actorUid: user.uid })
      if (res.error || !res.data) {
        toast.error(res.error ?? "تعذّر توليد أمر العمل")
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
      toast.success("تم توليد أمر العمل")
      // Prompt for the CAM request number immediately after generating.
      setReqPromptId(res.data.workOrderId)
    } finally {
      setGenBusy(false)
    }
  }

  if (!assetId) return <Navigate to="/dashboard/assets" replace />

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Skeleton className="min-h-[320px] rounded-xl" />
          <Skeleton className="min-h-[260px] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>لم يُعثر على الأصل</CardTitle>
          <CardDescription>قد يكون قد حُذف أو المعرف غير صحيح.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/dashboard/assets">
              العودة لقائمة الأصول <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const qrValue = asset.qrPayload?.trim() || assetPublicUrl(asset.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ms-2 mb-2 px-2">
            <Link to="/dashboard/assets">جميع الأصول</Link>
          </Button>
          <h1 className="font-bold text-2xl tracking-tight">{asset.assetName}</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{asset.assetCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/print/asset/${asset.id}`} target="_blank" rel="noreferrer">
              <Printer className="size-4" aria-hidden />
              كرت الصيانة
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/print/asset-report/${asset.id}`} target="_blank" rel="noreferrer">
              <FileText className="size-4" aria-hidden />
              تقرير مفصّل
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/print/sticker/${asset.id}`} target="_blank" rel="noreferrer">
              <Sticker className="size-4" aria-hidden />
              استيكر الموعد
            </Link>
          </Button>
          {canUpdate ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              تعديل
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              حذف
            </Button>
          ) : null}
        </div>
      </div>

      {nextService ? (
        <Card
          className="shadow-sm"
          style={{ borderInlineStartWidth: 4, borderInlineStartColor: serviceLevelColor(nextService.nextCode).solid }}
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <span
                className="flex size-11 items-center justify-center rounded-lg text-lg font-bold text-white"
                style={{ backgroundColor: serviceLevelColor(nextService.nextCode).solid }}
              >
                {nextService.nextLabel}
              </span>
              <div>
                <div className="text-sm font-medium">الخدمة القادمة — المستوى {nextService.nextLabel}</div>
                <div className="text-muted-foreground text-xs">
                  {nextService.templateName} · القراءة الحالية {Math.round(nextService.currentReading)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" style={{ color: nextService.isDue ? serviceLevelColor("A").solid : undefined }}>
                {nextService.isDue
                  ? `مستحقة الآن (+${String(Math.round(nextService.overdueBy))})`
                  : `بعد ${String(Math.round(nextService.remainingUntilDue))}`}
              </span>
              {canGenerate ? (
                <Button size="sm" disabled={genBusy} onClick={() => void generateService()}>
                  <Wrench className="size-4" aria-hidden />
                  {genBusy ? "يولّد…" : "توليد أمر عمل"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_min(100%,340px)]">
        <Card className="shadow-sm overflow-hidden lg:order-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-4" aria-hidden />
              صورة ومعلّم QR
            </CardTitle>
            <CardDescription>رابط هذه الصفحة في الرمز الثنائي</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div className="bg-muted/40 flex aspect-video w-full max-w-md items-center justify-center overflow-hidden rounded-lg border">
              {asset.imageUrl ? (
                <img src={asset.imageUrl} alt="" className="max-h-[280px] w-full object-contain" />
              ) : (
                <p className="text-muted-foreground text-sm">لا توجد صورة لهذا الأصل</p>
              )}
            </div>
            <div className="bg-card flex flex-col items-center gap-2 rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium text-sm">
                <QrCode className="size-4" aria-hidden />
                رمز الاستجابة السريعة
              </div>
              <QRCodeSVG value={qrValue} size={164} includeMargin bgColor="transparent" level="M" />
              <p dir="ltr" className="text-muted-foreground max-w-full truncate text-center text-xs">
                {qrValue}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(qrValue)}>
                نسخ الرابط
              </Button>
            </div>
            {asset.assetCode ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-medium">باركود الأصل</div>
                <AssetBarcode value={asset.assetCode} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:order-1">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>البيانات</CardTitle>
              <Badge variant="outline">{assetStatusAr[asset.status] ?? asset.status}</Badge>
              <Badge variant="secondary">{assetCategoryAr(asset.category)}</Badge>
            </div>
            <CardDescription>جدول حقول الأصل المعتمد على Firestore</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <DetailGrid asset={asset} />
            {(asset.installedAt || asset.lastServiceAt) && (
              <>
                <Separator />
                <div className="text-muted-foreground grid gap-2 text-sm">
                  {asset.installedAt ? (
                    <p>تاريخ التثبيت: {formatArDate(asset.installedAt)}</p>
                  ) : null}
                  {asset.lastServiceAt ? (
                    <p>آخر خدمة: {formatArDateTime(asset.lastServiceAt)}</p>
                  ) : null}
                </div>
              </>
            )}
            {asset.notes ? (
              <>
                <Separator />
                <div>
                  <p className="mb-2 font-medium text-sm">ملاحظات</p>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm">{asset.notes}</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AssetMeterPanel assetId={asset.id} />

      <AssetMaintenanceHistory assetId={asset.id} />

      <RequestNoPromptDialog
        workOrderId={reqPromptId}
        open={reqPromptId !== null}
        onDone={() => {
          const id = reqPromptId
          setReqPromptId(null)
          if (id) navigate(`/dashboard/work-orders/${id}`)
        }}
      />

      <AssetFormDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" asset={asset} />
      <AssetDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        asset={asset}
        onDeleted={() => navigate("/dashboard/assets", { replace: true })}
      />
    </div>
  )
}

function DetailGrid({ asset }: { asset: AssetRow }) {
  const rows = [
    { label: "المصنّع / العلامة", value: asset.brand?.trim() || "—" },
    { label: "الموديل", value: asset.model?.trim() || "—" },
    { label: "الرقم التسلسلي", value: asset.serialNo?.trim() || "—" },
    { label: "رقم اللوحة / الوحدة", value: asset.plateNo?.trim() || "—" },
    { label: "فئة المعدة (Eqm Cls)", value: asset.equipmentClass?.trim() || "—" },
    { label: "الموقع (Location)", value: asset.location || "—" },
    { label: "الفرع (Branch)", value: asset.branch?.trim() || "—" },
    { label: "وحدة العمل المسؤولة", value: asset.businessUnit?.trim() || asset.department?.trim() || "—" },
    {
      label: "ساعات التشغيل التراكمية",
      value: asset.operatingHours.toLocaleString("en-US"),
    },
    { label: "عداد الكيلومترات", value: asset.odometer.toLocaleString("en-US") },
    {
      label: "تاريخ الشراء",
      value: asset.purchaseDate ? formatArDate(asset.purchaseDate) : "—",
    },
    {
      label: "انتهاء الضمان",
      value: asset.warrantyExpiry ? formatArDate(asset.warrantyExpiry) : "—",
    },
    {
      label: "المورد / الوكالة",
      value: asset.vendorName?.trim() || "—",
    },
    {
      label: "معرّف المسؤول الميداني",
      value: asset.assignedToUid?.trim() || "—",
    },
    {
      label: "أنشئ في",
      value: formatArDateTime(asset.createdAt),
    },
    {
      label: "آخر تحديث بواسطة النظام",
      value: formatArDateTime(asset.updatedAt),
    },
    {
      label: "قطع احتياطية",
      value: asset.sparePartsNote?.trim() || "—",
    },
    {
      label: "وثائق داعمة",
      value: asset.documentsMeta?.trim() || "—",
    },
  ]
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="space-y-0.5">
          <dt className="text-muted-foreground text-xs font-medium">{row.label}</dt>
          <dd className="break-words text-sm font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
