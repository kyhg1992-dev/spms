import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import RoleGate from "@/components/auth/role-gate"
import { DangerZone } from "@/components/settings/danger-zone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useI18n } from "@/i18n/i18n"
import { useCompanySettingsQuery } from "@/hooks/use-spms-data"
import { updateCompanySettings } from "@/services/firestore/spms-service"

const finiteNum = (label: string) =>
  z.number().refine((n) => Number.isFinite(n), { message: `${label}: قيمة غير صالحة` })

const schema = z.object({
  companyNameAr: z.string().min(2).max(200),
  timezone: z.string().min(2).max(80),
  locale: z.string().min(2).max(12),
  defaultPmReminderDays: finiteNum("تذكير PM").min(0).max(90),
  meterAnomalyPct: finiteNum("عتبة الشذوذ").min(0).max(100),
  locationAliases: z.string().max(8000).optional(),
  requestBypassCode: z.string().trim().max(40).optional(),
})

type FormValues = z.infer<typeof schema>

export default function SettingsPage() {
  const { spmsRole } = useAuth()
  const { t } = useI18n()
  const q = useCompanySettingsQuery()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyNameAr: "مؤسسة صيانة المعدات الذكية",
      timezone: "Asia/Riyadh",
      locale: "ar-SA",
      defaultPmReminderDays: 7,
      meterAnomalyPct: 30,
      locationAliases: "",
      requestBypassCode: "",
    },
  })

  useEffect(() => {
    const d = q.data
    if (!d) return
    form.reset({
      companyNameAr: d.companyNameAr,
      timezone: d.timezone,
      locale: d.locale,
      defaultPmReminderDays: d.defaultPmReminderDays ?? 7,
      meterAnomalyPct: d.meterAnomalyPct ?? 30,
      locationAliases: d.locationAliases ?? "",
      requestBypassCode: d.requestBypassCode ?? "",
    })
  }, [q.data, form])

  const [logoBusy, setLogoBusy] = useState(false)
  const canManage = spmsRole === "admin" || spmsRole === "manager"

  async function submit(values: FormValues) {
    if (!spmsRole) return toast.error("تعذّر تأكيد الجلسة.")
    const res = await updateCompanySettings(spmsRole, {
      ...values,
      docKey: "main",
    })
    if (res.error) toast.error(res.error)
    else {
      toast.success(t("set.saved"))
      void q.refetch()
    }
  }

  async function saveLogo(dataUrl: string | undefined) {
    if (!spmsRole) return
    setLogoBusy(true)
    try {
      const res = await updateCompanySettings(spmsRole, { logoDataUrl: dataUrl ?? "", docKey: "main" })
      if (res.error) toast.error(res.error)
      else {
        toast.success(dataUrl ? t("set.logoSaved") : t("set.logoRemoved"))
        void q.refetch()
      }
    } finally {
      setLogoBusy(false)
    }
  }

  function onLogoFile(file: File | null) {
    if (!file) return
    if (file.size > 400_000) {
      toast.error(t("set.logoTooBig"))
      return
    }
    const reader = new FileReader()
    reader.onload = () => void saveLogo(String(reader.result))
    reader.onerror = () => toast.error("تعذّر قراءة الملف")
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Badge variant="outline" className="mb-3">
          {t("set.title")}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">{t("set.title")}</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">{t("set.subtitle")}</p>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-xl" />
      ) : (
        <Card className="max-w-3xl rounded-xl border-border/70 shadow-lg">
          <CardHeader>
            <CardTitle>{t("set.profile")}</CardTitle>
            <CardDescription>{t("set.profileHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-2">
              <Label>{t("set.logo")}</Label>
              <div className="flex items-center gap-4">
                <div className="bg-muted/40 flex size-20 items-center justify-center overflow-hidden rounded-lg border">
                  {q.data?.logoDataUrl ? (
                    <img src={q.data.logoDataUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-muted-foreground text-[11px]">—</span>
                  )}
                </div>
                {canManage ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      className="cursor-pointer"
                      disabled={logoBusy}
                      onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                    />
                    {q.data?.logoDataUrl ? (
                      <Button type="button" variant="outline" size="sm" disabled={logoBusy} onClick={() => void saveLogo(undefined)}>
                        {t("set.logoRemove")}
                      </Button>
                    ) : null}
                    <p className="text-muted-foreground text-xs">PNG/SVG · &lt; 400 KB</p>
                  </div>
                ) : null}
              </div>
            </div>
            <Separator className="mb-6" />
            <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
              <div className="space-y-2">
                <Label htmlFor="companyNameAr">{t("set.companyName")}</Label>
                <Input id="companyNameAr" {...form.register("companyNameAr")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">{t("set.timezone")}</Label>
                  <Input id="timezone" dir="ltr" {...form.register("timezone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale">{t("set.locale")}</Label>
                  <Input id="locale" dir="ltr" {...form.register("locale")} />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("set.pmReminder")}</Label>
                  <Input type="number" {...form.register("defaultPmReminderDays", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("set.anomaly")}</Label>
                  <Input type="number" {...form.register("meterAnomalyPct", { valueAsNumber: true })} />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="locationAliases">{t("set.aliases")}</Label>
                <Textarea
                  id="locationAliases"
                  rows={5}
                  dir="ltr"
                  className="font-mono text-xs"
                  placeholder={"VMM101=الرياض\nFC101=جدة\nDM101=الرياض\nTBK201=تبوك"}
                  {...form.register("locationAliases")}
                />
                <p className="text-muted-foreground text-xs leading-relaxed">{t("set.aliasesHint")}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="requestBypassCode">{t("set.bypassCode")}</Label>
                <Input id="requestBypassCode" dir="ltr" className="max-w-xs font-mono" placeholder="202520262027" {...form.register("requestBypassCode")} />
                <p className="text-muted-foreground text-xs leading-relaxed">{t("set.bypassCodeHint")}</p>
              </div>
              <RoleGate roles={["admin", "manager"]}>
                <Button type="submit">{t("common.save")}</Button>
              </RoleGate>
            </form>
          </CardContent>
        </Card>
      )}

      <DangerZone />
    </div>
  )
}
