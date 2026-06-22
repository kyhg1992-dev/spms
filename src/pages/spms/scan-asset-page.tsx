import { ArrowRight, Gauge, Printer, Wrench } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { RequestNoPromptDialog } from "@/components/work-orders/request-no-prompt-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery, useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import { useI18n } from "@/i18n/i18n"
import { formatArDate } from "@/lib/format"
import { deriveNextServiceForAsset } from "@/lib/maintenance-next-service"
import { serviceLevelColor } from "@/lib/spms-colors"
import type { MaintenanceSequenceTemplate, MeterReadingKind } from "@/models/firestore"
import {
  createMeterReadingWithPMEngine,
  createNotification,
  generateAssetServiceWorkOrder,
} from "@/services/firestore/spms-service"

export default function ScanAssetPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const { t } = useI18n()
  const { spmsRole, user } = useAuth()
  const assets = useAssetsQuery()
  const templates = useMaintenanceTemplatesQuery()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [kind, setKind] = useState<MeterReadingKind>("operating_hours")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [reqPromptId, setReqPromptId] = useState<string | null>(null)

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
    return (
      <div className="mx-auto max-w-md p-4">
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }
  if (!asset) {
    return <div className="p-10 text-center text-sm text-muted-foreground">لم يُعثر على الأصل.</div>
  }

  const next = deriveNextServiceForAsset({ asset, templatesById })
  const isManager = spmsRole === "admin" || spmsRole === "manager"
  const canEnterReading = spmsRole === "admin" || spmsRole === "manager" || spmsRole === "technician"

  async function submitReading() {
    if (!spmsRole || !user?.uid) return
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) {
      toast.error(t("scan.invalidReading"))
      return
    }
    setBusy(true)
    try {
      const res = await createMeterReadingWithPMEngine(spmsRole, {
        assetId: asset!.id,
        kind,
        value: num,
        enteredByUid: user.uid,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["assets"] })
      toast.success(t("scan.readingSaved"))
      setValue("")
    } finally {
      setBusy(false)
    }
  }

  async function requestAction(isDue: boolean) {
    if (!spmsRole || !user?.uid) return
    setBusy(true)
    try {
      const res = await createNotification(spmsRole, {
        userId: user.uid,
        targetRole: "manager",
        type: "work_order",
        channel: "in_app",
        priority: isDue ? "high" : "normal",
        title: isDue ? `طلب تنفيذ صيانة — ${asset!.assetCode}` : `طلب استثناء صيانة — ${asset!.assetCode}`,
        body: isDue
          ? `الفنّي يطلب تنفيذ صيانة مستوى ${next?.nextLabel ?? ""} للأصل ${asset!.assetName}.`
          : `الفنّي يطلب استثناء (الصيانة غير مستحقة بعد) للأصل ${asset!.assetName}.`,
        isRead: false,
        isArchived: false,
        refPath: `assets/${asset!.id}`,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(isDue ? t("scan.requestSentExec") : t("scan.requestSentExc"))
    } finally {
      setBusy(false)
    }
  }

  async function generate() {
    if (!spmsRole || !user?.uid) return
    setBusy(true)
    try {
      const res = await generateAssetServiceWorkOrder(spmsRole, { assetId: asset!.id, actorUid: user.uid })
      if (res.error || !res.data) {
        toast.error(res.error ?? "تعذّر التوليد")
        return
      }
      toast.success("تم توليد أمر العمل")
      setReqPromptId(res.data.workOrderId)
    } finally {
      setBusy(false)
    }
  }

  const nsColor = next ? serviceLevelColor(next.nextCode) : null

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{asset.assetName}</h1>
          <p className="text-muted-foreground text-sm" dir="ltr">{asset.assetCode} · {asset.plateNo}</p>
        </div>
        <Button asChild variant="outline" size="icon" aria-label="طباعة كرت">
          <Link to={`/print/asset/${asset.id}`} target="_blank" rel="noreferrer"><Printer className="size-4" /></Link>
        </Button>
      </div>

      <Card className="overflow-hidden shadow-sm" style={nsColor ? { borderInlineStartWidth: 4, borderInlineStartColor: nsColor.solid } : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("scan.maintStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {next ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("scan.nextService")}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm font-bold text-white" style={{ backgroundColor: nsColor!.solid }}>{next.nextLabel}</span>
                  <span className="font-medium" style={{ color: next.isDue ? serviceLevelColor("A").solid : undefined }}>
                    {next.isDue ? `${t("scan.dueNow")} (+${String(Math.round(next.overdueBy))})` : `${t("scan.after")} ${String(Math.round(next.remainingUntilDue))}`}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("scan.lastService")}</span>
                <span className="font-medium">
                  {next.lastLabel ?? asset.lastServiceCode ?? "—"}
                  {asset.lastServiceReading != null ? ` · عند ${Math.round(asset.lastServiceReading)}` : ""}
                  {asset.lastServiceAt ? ` · ${formatArDate(asset.lastServiceAt)}` : ""}
                </span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{t("scan.noTemplate")}</p>
          )}
        </CardContent>
      </Card>

      {canEnterReading ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Gauge className="size-4" /> {t("scan.recordReading")}</CardTitle>
            <CardDescription>{t("scan.currentReading")}: {Math.round(asset.operatingHours)} س · {Math.round(asset.odometer)} كم</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("scan.type")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as MeterReadingKind)}>
                <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operating_hours">{t("scan.hours")}</SelectItem>
                  <SelectItem value="odometer">{t("scan.km")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="reading" className="text-xs">{t("scan.reading")}</Label>
              <Input id="reading" type="number" min={0} dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <Button disabled={busy} onClick={() => void submitReading()}>{t("scan.record")}</Button>
          </CardContent>
        </Card>
      ) : null}

      {next ? (
        <div className="flex flex-col gap-2">
          {isManager ? (
            <Button disabled={busy} onClick={() => void generate()}>
              <Wrench className="size-4" /> {t("scan.generateWO")} ({next.nextLabel})
            </Button>
          ) : next.isDue ? (
            <Button disabled={busy} onClick={() => void requestAction(true)}>
              <Wrench className="size-4" /> {t("scan.requestExec")}
            </Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => void requestAction(false)}>
              {t("scan.requestException")}
            </Button>
          )}
        </div>
      ) : null}

      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link to={`/dashboard/assets/${asset.id}`}>
          {t("common.fullDetails")} <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      </Button>

      <RequestNoPromptDialog
        workOrderId={reqPromptId}
        open={reqPromptId !== null}
        onDone={() => {
          const id = reqPromptId
          setReqPromptId(null)
          if (id) navigate(`/dashboard/work-orders/${id}`)
        }}
      />
    </div>
  )
}
