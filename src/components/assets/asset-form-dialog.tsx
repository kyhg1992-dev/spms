import { zodResolver } from "@hookform/resolvers/zod"
import { Timestamp } from "firebase/firestore"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery, useMaintenanceTemplatesQuery, useUsersQuery } from "@/hooks/use-spms-data"
import { ASSET_CATEGORY_IDS, DEFAULT_ASSET_CATEGORY, assetCategoryAr } from "@/lib/asset-categories"
import { KNOWN_SITE_NAMES } from "@/lib/saudi-locations"
import { deleteAssetDownloadUrl, uploadAssetPrimaryImage } from "@/lib/storage-asset-image"
import type { Asset } from "@/models/firestore"
import { assetFormSchema, type AssetFormInput } from "@/schemas/asset"
import { appendActivityLog } from "@/services/audit"
import { createAsset, updateAsset } from "@/services/firestore/spms-service"
import { canAccess } from "@/services/firestore/permissions"

function toDateInputValue(ts: Timestamp | undefined): string {
  if (!ts || typeof ts.toDate !== "function") return ""
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function tsFromDateStr(s: string, endOfDay = false): Timestamp | undefined {
  if (!s.trim()) return undefined
  const d = new Date(`${s}T${endOfDay ? "23:59:59" : "12:00:00"}`)
  if (Number.isNaN(d.getTime())) return undefined
  return Timestamp.fromDate(d)
}

function formDefaults(asset?: Asset & { id: string }): AssetFormInput {
  if (!asset) {
    return {
      assetCode: "",
      assetName: "",
      category: DEFAULT_ASSET_CATEGORY,
      brand: "",
      model: "",
      serialNo: "",
      plateNo: "",
      department: "",
      location: "",
      operatingHours: 0,
      odometer: 0,
      status: "active",
      purchaseDate: "",
      warrantyExpiry: "",
      assignedToUid: "",
      vendorName: "",
      sparePartsNote: "",
      documentsMeta: "",
      qrPayload: "",
      maintenanceTemplateId: "",
      lastServiceCode: "",
      lastServiceReading: 0,
      latitude: undefined,
      longitude: undefined,
      notes: "",
    }
  }
  return {
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    category: (ASSET_CATEGORY_IDS as readonly string[]).includes(asset.category)
      ? (asset.category as AssetFormInput["category"])
      : DEFAULT_ASSET_CATEGORY,
    brand: asset.brand,
    model: asset.model,
    serialNo: asset.serialNo,
    plateNo: asset.plateNo,
    department: asset.department,
    location: asset.location,
    operatingHours: asset.operatingHours,
    odometer: asset.odometer,
    status: asset.status,
    purchaseDate: toDateInputValue(asset.purchaseDate),
    warrantyExpiry: toDateInputValue(asset.warrantyExpiry),
    assignedToUid: asset.assignedToUid ?? "",
    vendorName: asset.vendorName ?? "",
    sparePartsNote: asset.sparePartsNote ?? "",
    documentsMeta: asset.documentsMeta ?? "",
    qrPayload: asset.qrPayload ?? "",
    maintenanceTemplateId: asset.maintenanceTemplateId ?? "",
    lastServiceCode: asset.lastServiceCode ?? "",
    lastServiceReading: asset.lastServiceReading ?? 0,
    latitude: asset.latitude,
    longitude: asset.longitude,
    notes: asset.notes,
  }
}

function toWritePayload(values: AssetFormInput, imageUrl: string): Omit<Asset, "id" | "createdAt" | "updatedAt"> {
  return {
    assetCode: values.assetCode.trim(),
    assetName: values.assetName.trim(),
    category: values.category,
    brand: values.brand.trim(),
    model: values.model.trim(),
    serialNo: values.serialNo.trim(),
    plateNo: values.plateNo.trim(),
    department: values.department.trim(),
    location: values.location.trim(),
    operatingHours: values.operatingHours,
    odometer: values.odometer,
    status: values.status,
    purchaseDate: tsFromDateStr(values.purchaseDate, false),
    warrantyExpiry: tsFromDateStr(values.warrantyExpiry, true),
    assignedToUid: values.assignedToUid.trim() ? values.assignedToUid.trim() : undefined,
    vendorName: values.vendorName.trim() || undefined,
    sparePartsNote: values.sparePartsNote.trim() || undefined,
    documentsMeta: values.documentsMeta.trim() || undefined,
    qrPayload: values.qrPayload.trim() || undefined,
    maintenanceTemplateId: values.maintenanceTemplateId.trim() || undefined,
    lastServiceCode: values.lastServiceCode.trim()
      ? (values.lastServiceCode.trim().toUpperCase() as Asset["lastServiceCode"])
      : undefined,
    lastServiceReading: values.lastServiceReading || undefined,
    latitude: typeof values.latitude === "number" ? values.latitude : undefined,
    longitude: typeof values.longitude === "number" ? values.longitude : undefined,
    notes: values.notes.trim(),
    imageUrl,
  }
}

type AssetFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  asset?: Asset & { id: string }
}

export function AssetFormDialog({ open, onOpenChange, mode, asset }: AssetFormDialogProps) {
  const { spmsRole, user } = useAuth()
  const { data: roster } = useUsersQuery()
  const { data: templates } = useMaintenanceTemplatesQuery()
  const { data: allAssets } = useAssetsQuery()
  const canPickAssignee = !!spmsRole && canAccess(spmsRole, "users", "read") && !!(roster && roster.length)

  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<AssetFormInput>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: formDefaults(asset),
  })

  const selectedTemplateId = form.watch("maintenanceTemplateId")
  const selectedTemplate = (templates ?? []).find((t) => t.id === selectedTemplateId)
  const templateCodes = selectedTemplate
    ? Array.from(new Set(selectedTemplate.sequence ?? []))
    : []


  function handleDialogOpenChange(next: boolean) {
    if (!next) setFile(null)
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open) return
    form.reset(formDefaults(asset))
  }, [open, asset, form])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!spmsRole || !user?.uid) {
      toast.error("لم يتم تحميل صلاحية المستخدم.")
      return
    }

    setSubmitting(true)
    try {
      const baseImg = asset?.imageUrl ?? ""
      const payloadPreview = toWritePayload(values, baseImg)

      if (mode === "create") {
        const code = values.assetCode.trim().toLowerCase()
        if ((allAssets ?? []).some((a) => a.assetCode.trim().toLowerCase() === code)) {
          toast.error("رقم الأصل مستخدم بالفعل — الباركود يجب أن يكون فريداً")
          return
        }
        const created = await createAsset(spmsRole, { ...toWritePayload(values, ""), imageUrl: "" })
        if (created.error || !created.data) {
          toast.error(created.error ?? "تعذر إنشاء الأصل")
          return
        }
        const id = created.data
        let imageUrl = ""
        if (file) {
          try {
            imageUrl = await uploadAssetPrimaryImage(id, file)
            await updateAsset(spmsRole, id, { imageUrl })
          } catch {
            toast.error("تم الإنشاء لكن تعذر رفع الصورة")
          }
        }
        await appendActivityLog({
          actorUid: user.uid,
          actionKey: "asset.create",
          entityType: "asset",
          entityId: id,
          labelAr: `إنشاء أصل ${payloadPreview.assetCode}`,
        })
        toast.success("تمت إضافة الأصل")
        handleDialogOpenChange(false)
        return
      }

      if (!asset) return
      let imageUrl = asset.imageUrl
      if (file) {
        if (asset.imageUrl) await deleteAssetDownloadUrl(asset.imageUrl)
        imageUrl = await uploadAssetPrimaryImage(asset.id, file)
      }

      const upd = await updateAsset(spmsRole, asset.id, {
        ...toWritePayload(values, imageUrl),
        imageUrl,
      })
      if (upd.error) {
        toast.error(upd.error)
        return
      }
      await appendActivityLog({
        actorUid: user.uid,
        actionKey: "asset.update",
        entityType: "asset",
        entityId: asset.id,
        labelAr: `تحديث أصل ${values.assetCode}`,
      })
      toast.success("تم حفظ التعديلات")
      handleDialogOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "إضافة أصل للأسطول" : "تحرير بيانات الأصل"}</DialogTitle>
          <DialogDescription>
            حقول وفق معيار المؤسسات مع تتبع الضمان وجهة العمل وفني الإسناد.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 pe-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assetCode">رمز الأصل (الباركود)</Label>
              <Input id="assetCode" dir="ltr" disabled={mode === "edit"} {...form.register("assetCode")} />
              {mode === "edit" ? (
                <p className="text-muted-foreground text-xs">لا يُعدّل بعد الإنشاء — لضمان ثبات الباركود.</p>
              ) : null}
              {form.formState.errors.assetCode ? (
                <p className="text-destructive text-xs">{form.formState.errors.assetCode.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetName">التسمية</Label>
              <Input id="assetName" {...form.register("assetName")} />
              {form.formState.errors.assetName ? (
                <p className="text-destructive text-xs">{form.formState.errors.assetName.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Controller
                name="category"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as AssetFormInput["category"])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_CATEGORY_IDS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {assetCategoryAr(id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.category ? (
                <p className="text-destructive text-xs">{String(form.formState.errors.category.message)}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">الحالة التشغيلية</Label>
              <Controller
                name="status"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as AssetFormInput["status"])}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="maintenance">صيانة / توقّف جزئي</SelectItem>
                      <SelectItem value="retired">متوقف</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="brand">العلامة / المصنّع</Label>
              <Input id="brand" {...form.register("brand")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">الموديل</Label>
              <Input id="model" {...form.register("model")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialNo">التسلسل</Label>
              <Input id="serialNo" {...form.register("serialNo")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plateNo">رقم اللوحة / المركبة</Label>
              <Input id="plateNo" {...form.register("plateNo")} />
              {form.formState.errors.plateNo ? (
                <p className="text-destructive text-xs">{form.formState.errors.plateNo.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">القطاع / الإدارة</Label>
              <Input id="department" {...form.register("department")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">الموقع (الموقع المعرّف للأصل)</Label>
              <Input id="location" list="known-sites" placeholder="مثل: جدة، رابغ، تبوك، خميس مشيط" {...form.register("location")} />
              <datalist id="known-sites">
                {KNOWN_SITE_NAMES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {form.formState.errors.location ? (
                <p className="text-destructive text-xs">{form.formState.errors.location.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>فني أو مسؤول الإسناد</Label>
              {canPickAssignee ? (
                <Controller
                  name="assignedToUid"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value?.trim() ? field.value.trim() : "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="بدون إسناد" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">بدون إسناد</SelectItem>
                        {(roster ?? [])
                          .filter((u) => u.isActive && (u.role === "technician" || u.role === "manager"))
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.displayName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <Input {...form.register("assignedToUid")} placeholder="معرّف المستخدم (اختياري)" dir="ltr" />
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operatingHours">ساعات التشغيل الجارية</Label>
              <Input
                id="operatingHours"
                type="number"
                min={0}
                step={1}
                {...form.register("operatingHours", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odometer">عداد المسافة (كم)</Label>
              <Input id="odometer" type="number" min={0} step={1} {...form.register("odometer", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">تاريخ الشراء</Label>
              <Input id="purchaseDate" type="date" {...form.register("purchaseDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warrantyExpiry">انتهاء الضمان</Label>
              <Input id="warrantyExpiry" type="date" {...form.register("warrantyExpiry")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendorName">المورّد / الوكالة</Label>
              <Input id="vendorName" {...form.register("vendorName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qrPayload">حمولة QR الثابتة (اختياري)</Label>
              <Input id="qrPayload" {...form.register("qrPayload")} placeholder="مسار خارجي أو تعليمة" dir="ltr" />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-medium">قالب الصيانة وآخر خدمة</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>قالب الصيانة المطبّق</Label>
                <Controller
                  name="maintenanceTemplateId"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value?.trim() ? field.value : "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="بدون قالب" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">بدون قالب</SelectItem>
                        {(templates ?? []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.assetTypeLabel ? ` — ${t.assetTypeLabel}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>آخر خدمة تمّت</Label>
                  <Controller
                    name="lastServiceCode"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value?.trim() ? field.value : "__none__"}
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        disabled={!selectedTemplate}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— لا يوجد</SelectItem>
                          {templateCodes.map((code) => (
                            <SelectItem key={code} value={code}>{code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastServiceReading">قراءة آخر خدمة</Label>
                  <Input
                    id="lastServiceReading"
                    type="number"
                    min={0}
                    {...form.register("lastServiceReading", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              لأن الصيانة سارية: حدّد القالب، ثم آخر خدمة تمّت وقراءتها — ليبدأ النظام التناوب من حيث وصلت لا من الصفر.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">صورة المعدات</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              className="cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="sparePartsNote">قطع احتياطية مرتبطة</Label>
              <Textarea id="sparePartsNote" rows={2} {...form.register("sparePartsNote")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentsMeta">وثائق / أدلة التشغيل</Label>
              <Textarea id="documentsMeta" rows={2} {...form.register("documentsMeta")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات تشغيلية</Label>
            <Textarea id="notes" rows={3} {...form.register("notes")} />
          </div>

          <DialogFooter className="sticky bottom-0 gap-2 border-t bg-background/95 pb-2 pt-4 backdrop-blur sm:sticky">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "يتم المعالجة…" : mode === "create" ? "تأكيد الإضافة" : "احفظ التغييرات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
