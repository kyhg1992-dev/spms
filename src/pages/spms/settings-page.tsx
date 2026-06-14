import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import RoleGate from "@/components/auth/role-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
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
})

type FormValues = z.infer<typeof schema>

export default function SettingsPage() {
  const { spmsRole } = useAuth()
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
      toast.success("تم تحديث إعدادات المؤسسة")
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
        toast.success(dataUrl ? "تم حفظ اللوجو" : "تم حذف اللوجو")
        void q.refetch()
      }
    } finally {
      setLogoBusy(false)
    }
  }

  function onLogoFile(file: File | null) {
    if (!file) return
    if (file.size > 400_000) {
      toast.error("حجم اللوجو كبير (الحد ٤٠٠ كيلوبايت). استخدم صورة أصغر.")
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
          تكوين النظام
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">إعدادات مؤسسية وتفضيلات التشغيل</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          تهيئة بيانات المؤسسة وضوابط تنبيهات الصيانة. يستخدم التطبيق وثائق Firestore مجموعة{" "}
          <span dir="ltr" className="font-mono text-xs">
            companySettings/main
          </span>
          .
        </p>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-xl" />
      ) : (
        <Card className="max-w-3xl rounded-xl border-border/70 shadow-lg">
          <CardHeader>
            <CardTitle>الملف المؤسسي</CardTitle>
            <CardDescription>يعرض جميع الصلاحيات، لكن الحفظ يقتصر على المدراء أو المشرف العام فقط.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-2">
              <Label>لوجو الشركة (يظهر في الرئيسية والتقارير وكرت الصيانة)</Label>
              <div className="flex items-center gap-4">
                <div className="bg-muted/40 flex size-20 items-center justify-center overflow-hidden rounded-lg border">
                  {q.data?.logoDataUrl ? (
                    <img src={q.data.logoDataUrl} alt="لوجو الشركة" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-muted-foreground text-[11px]">لا يوجد</span>
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
                        حذف اللوجو
                      </Button>
                    ) : null}
                    <p className="text-muted-foreground text-xs">PNG/SVG بخلفية شفافة، أقل من ٤٠٠ كيلوبايت.</p>
                  </div>
                ) : null}
              </div>
            </div>
            <Separator className="mb-6" />
            <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
              <div className="space-y-2">
                <Label htmlFor="companyNameAr">الاسم التجاري العربي المعروض للفرق الصيانية</Label>
                <Input id="companyNameAr" {...form.register("companyNameAr")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">المحيط الزمني</Label>
                  <Input id="timezone" dir="ltr" {...form.register("timezone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale">اللغة الافتراضية</Label>
                  <Input id="locale" dir="ltr" {...form.register("locale")} />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>تذكير PM قبل (أيام)</Label>
                  <Input type="number" {...form.register("defaultPmReminderDays", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>عتبة شذوذ العداد (%)</Label>
                  <Input type="number" {...form.register("meterAnomalyPct", { valueAsNumber: true })} />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="locationAliases">مرادفات المواقع للخريطة (رمز الموقع = المدينة)</Label>
                <Textarea
                  id="locationAliases"
                  rows={5}
                  dir="ltr"
                  className="font-mono text-xs"
                  placeholder={"VMM101=الرياض\nFC101=جدة\nDM101=الرياض\nTBK201=تبوك"}
                  {...form.register("locationAliases")}
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  سطر لكل رمز: «الرمز = اسم المدينة». تُستخدم لرسم الأصول المستوردة (التي مواقعها رموز) على خريطة الأسطول.
                </p>
              </div>
              <RoleGate roles={["admin", "manager"]}>
                <Button type="submit">حفظ الإعدادات</Button>
              </RoleGate>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
