import { Timestamp } from "firebase/firestore"
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2, Wrench } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import type { Asset, PMSchedule, PMServiceType, PMTriggerMode } from "@/models/firestore"
import {
  completePMFromWorkOrder,
  createPMSchedule,
  generatePMWorkOrder,
  updatePMSchedule,
} from "@/services/firestore/spms-service"

type PMFormMode = "create" | "edit"

type PMScheduleManagementDialogProps = {
  schedule?: PMSchedule & { id: string }
  assets: Array<Asset & { id: string }>
  mode: PMFormMode
  dir?: "rtl" | "ltr"
  language?: "ar" | "en"
}

const serviceTypes: PMServiceType[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as PMServiceType[]
const triggerModes: PMTriggerMode[] = ["time", "hours", "km", "both"]

const labels = {
  ar: {
    create: "إضافة خطة PM",
    edit: "تعديل خطة PM",
    description: "إدارة جدول الصيانة الوقائية دون تغيير بنية النظام.",
    title: "عنوان الخطة",
    asset: "الأصل",
    serviceType: "نوع الخدمة",
    triggerMode: "طريقة التشغيل",
    frequencyDays: "التكرار بالأيام",
    intervalHours: "فاصل ساعات التشغيل",
    intervalKm: "فاصل الكيلومترات",
    autoCreateWorkOrder: "توليد أمر عمل تلقائيا",
    template: "قالب الصيانة",
    noTemplate: "بدون قالب",
    active: "نشطة",
    paused: "موقوفة",
    save: "حفظ",
    cancel: "إلغاء",
    required: "تحقق من الحقول المطلوبة حسب طريقة التشغيل.",
    saved: "تم حفظ خطة الصيانة الوقائية.",
    pause: "إيقاف",
    resume: "استئناف",
    deactivate: "تعطيل",
    generate: "توليد WO",
    complete: "إكمال من WO",
    generated: "تم توليد أمر العمل أو منع التكرار بأمان.",
    completed: "تم إكمال خطة PM وحساب الموعد التالي.",
    managerOnly: "متاح للمدير أو مسؤول النظام فقط.",
  },
  en: {
    create: "Add PM Schedule",
    edit: "Edit PM Schedule",
    description: "Manage preventive maintenance schedules without changing system architecture.",
    title: "Schedule Title",
    asset: "Asset",
    serviceType: "Service Type",
    triggerMode: "Trigger Mode",
    frequencyDays: "Frequency Days",
    intervalHours: "Operating Hours Interval",
    intervalKm: "Kilometer Interval",
    autoCreateWorkOrder: "Auto-create work order",
    template: "Maintenance Template",
    noTemplate: "No template",
    active: "Active",
    paused: "Paused",
    save: "Save",
    cancel: "Cancel",
    required: "Check required fields for the selected trigger mode.",
    saved: "PM schedule saved.",
    pause: "Pause",
    resume: "Resume",
    deactivate: "Deactivate",
    generate: "Generate WO",
    complete: "Complete from WO",
    generated: "Work order generated or duplicate safely prevented.",
    completed: "PM completed and next schedule calculated.",
    managerOnly: "Available to manager or system admin only.",
  },
}

function nextRunAtFromDays(days: number): Timestamp {
  const date = new Date()
  date.setDate(date.getDate() + Math.max(1, days))
  return Timestamp.fromDate(date)
}

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function managerRole(role: string | null): boolean {
  return role === "admin" || role === "manager"
}

function requiresHours(mode: PMTriggerMode): boolean {
  return mode === "hours" || mode === "both"
}

function requiresKm(mode: PMTriggerMode): boolean {
  return mode === "km" || mode === "both"
}

export function PMScheduleManagementDialog({
  schedule,
  assets,
  mode,
  dir = "rtl",
  language = "ar",
}: PMScheduleManagementDialogProps) {
  const text = labels[language]
  const queryClient = useQueryClient()
  const { spmsRole, user } = useAuth()
  const maintenanceTemplates = useMaintenanceTemplatesQuery()
  const templateList = maintenanceTemplates.data ?? []
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState(schedule?.maintenanceTemplateId ?? "")
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState(schedule?.title ?? "")
  const [assetId, setAssetId] = useState(schedule?.assetId ?? "")
  const [serviceType, setServiceType] = useState<PMServiceType>(schedule?.serviceType ?? "A")
  const [triggerMode, setTriggerMode] = useState<PMTriggerMode>(schedule?.triggerMode ?? "time")
  const [frequencyDays, setFrequencyDays] = useState(String(schedule?.frequencyDays ?? 30))
  const [intervalHours, setIntervalHours] = useState(String(schedule?.meterHoursInterval ?? ""))
  const [intervalKm, setIntervalKm] = useState(String(schedule?.meterKmInterval ?? ""))
  const [autoCreateWorkOrder, setAutoCreateWorkOrder] = useState(Boolean(schedule?.autoCreateWorkOrder))
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true)

  function resetForm() {
    setTitle(schedule?.title ?? "")
    setAssetId(schedule?.assetId ?? "")
    setServiceType(schedule?.serviceType ?? "A")
    setTriggerMode(schedule?.triggerMode ?? "time")
    setFrequencyDays(String(schedule?.frequencyDays ?? 30))
    setIntervalHours(String(schedule?.meterHoursInterval ?? ""))
    setIntervalKm(String(schedule?.meterKmInterval ?? ""))
    setAutoCreateWorkOrder(Boolean(schedule?.autoCreateWorkOrder))
    setIsActive(schedule?.isActive ?? true)
    setTemplateId(schedule?.maintenanceTemplateId ?? "")
  }

  function onPickTemplate(value: string) {
    const id = value === "__none__" ? "" : value
    setTemplateId(id)
    const tpl = templateList.find((t) => t.id === id)
    if (tpl) {
      if (tpl.sequence?.[0]) setServiceType(tpl.sequence[0])
      if (tpl.triggerMode === "hours") {
        setTriggerMode("hours")
        setIntervalHours(String(tpl.stepInterval))
      } else if (tpl.triggerMode === "km") {
        setTriggerMode("km")
        setIntervalKm(String(tpl.stepInterval))
      }
    }
  }

  const canManage = managerRole(spmsRole)
  const validation = useMemo(() => {
    const errors: string[] = []
    const days = toNumber(frequencyDays)
    const hours = toNumber(intervalHours)
    const km = toNumber(intervalKm)
    if (!title.trim()) errors.push(text.title)
    if (!assetId.trim()) errors.push(text.asset)
    if (!days || days <= 0) errors.push(text.frequencyDays)
    if (requiresHours(triggerMode) && (!hours || hours <= 0)) errors.push(text.intervalHours)
    if (requiresKm(triggerMode) && (!km || km <= 0)) errors.push(text.intervalKm)
    return errors
  }, [assetId, frequencyDays, intervalHours, intervalKm, text, title, triggerMode])

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["pmSchedules"] })
    await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  async function submit() {
    if (!spmsRole || !user?.uid || !canManage) {
      toast.error(text.managerOnly)
      return
    }
    if (validation.length > 0) {
      toast.error(text.required)
      return
    }

    const days = toNumber(frequencyDays) ?? 30
    const payload = {
      assetId,
      title: title.trim(),
      serviceType,
      triggerMode,
      frequencyDays: days,
      nextRunAt: schedule?.nextRunAt ?? nextRunAtFromDays(days),
      isActive,
      meterHoursInterval: requiresHours(triggerMode) ? toNumber(intervalHours) : undefined,
      meterKmInterval: requiresKm(triggerMode) ? toNumber(intervalKm) : undefined,
      autoCreateWorkOrder,
      maintenanceTemplateId: templateId || undefined,
    }

    setBusy(true)
    try {
      const result =
        mode === "create"
          ? await createPMSchedule(spmsRole, payload)
          : await updatePMSchedule(spmsRole, schedule!.id, payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(text.saved)
      setOpen(false)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function quickUpdate(active: boolean) {
    if (!schedule || !spmsRole || !canManage) {
      toast.error(text.managerOnly)
      return
    }
    const result = await updatePMSchedule(spmsRole, schedule.id, { isActive: active })
    if (result.error) {
      toast.error(result.error)
      return
    }
    await refresh()
  }

  async function generate() {
    if (!schedule || !spmsRole || !user?.uid || !canManage) {
      toast.error(text.managerOnly)
      return
    }
    const result = await generatePMWorkOrder(spmsRole, {
      pmScheduleId: schedule.id,
      actorUid: user.uid,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(text.generated)
    await refresh()
  }

  async function complete() {
    if (!schedule?.lastGeneratedWorkOrderId || !spmsRole || !user?.uid || !canManage) {
      toast.error(text.managerOnly)
      return
    }
    const result = await completePMFromWorkOrder(spmsRole, {
      pmScheduleId: schedule.id,
      workOrderId: schedule.lastGeneratedWorkOrderId,
      actorUid: user.uid,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(text.completed)
    await refresh()
  }

  return (
    <div dir={dir} className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          size="sm"
          variant={mode === "create" ? "default" : "outline"}
          className="gap-2"
          disabled={!canManage}
          title={!canManage ? text.managerOnly : undefined}
          onClick={() => {
            resetForm()
            setOpen(true)
          }}
        >
          {mode === "create" ? <Plus className="size-4" /> : <Pencil className="size-4" />}
          {mode === "create" ? text.create : text.edit}
        </Button>
        <DialogContent dir={dir} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? text.create : text.edit}</DialogTitle>
            <DialogDescription>{text.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={text.title}>
              <Input value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label={text.asset}>
              <Select value={assetId} onValueChange={setAssetId} disabled={busy || mode === "edit"}>
                <SelectTrigger>
                  <SelectValue placeholder={text.asset} />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.assetName} - {asset.assetCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={text.template}>
              <Select value={templateId || "__none__"} onValueChange={onPickTemplate} disabled={busy}>
                <SelectTrigger>
                  <SelectValue placeholder={text.noTemplate} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{text.noTemplate}</SelectItem>
                  {templateList.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.assetTypeLabel ? ` — ${tpl.assetTypeLabel}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={text.serviceType}>
                <Select value={serviceType} onValueChange={(value) => setServiceType(value as PMServiceType)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={text.triggerMode}>
                <Select value={triggerMode} onValueChange={(value) => setTriggerMode(value as PMTriggerMode)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {triggerModes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={text.frequencyDays}>
                <Input type="number" min="1" value={frequencyDays} disabled={busy} onChange={(event) => setFrequencyDays(event.target.value)} />
              </Field>
              <Field label={text.intervalHours}>
                <Input type="number" min="0" value={intervalHours} disabled={busy || !requiresHours(triggerMode)} onChange={(event) => setIntervalHours(event.target.value)} />
              </Field>
              <Field label={text.intervalKm}>
                <Input type="number" min="0" value={intervalKm} disabled={busy || !requiresKm(triggerMode)} onChange={(event) => setIntervalKm(event.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 rounded-md border bg-muted/30 p-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={autoCreateWorkOrder} disabled={busy} onChange={(event) => setAutoCreateWorkOrder(event.target.checked)} />
                {text.autoCreateWorkOrder}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={isActive} disabled={busy} onChange={(event) => setIsActive(event.target.checked)} />
                {isActive ? text.active : text.paused}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {text.cancel}
            </Button>
            <Button type="button" disabled={busy || validation.length > 0} onClick={() => void submit()}>
              {text.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {schedule ? (
        <>
          <Button type="button" size="sm" variant="outline" disabled={!canManage} onClick={() => void quickUpdate(!schedule.isActive)}>
            {schedule.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
            {schedule.isActive ? text.pause : text.resume}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!canManage || !schedule.isActive} onClick={() => void generate()}>
            <Wrench className="size-4" />
            {text.generate}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!canManage || !schedule.lastGeneratedWorkOrderId} onClick={() => void complete()}>
            <CalendarClock className="size-4" />
            {text.complete}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!canManage || !schedule.isActive} onClick={() => void quickUpdate(false)}>
            <Trash2 className="size-4" />
            {text.deactivate}
          </Button>
        </>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
