import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

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
import { userRoleAr } from "@/lib/labels-ar"
import type { SpmsUser, UserRole } from "@/models/firestore"
import { appendActivityLog } from "@/services/audit"
import { updateUser } from "@/services/firestore/spms-service"
import { createUserWithProfile } from "@/services/firestore/user-admin-service"

const ROLES: UserRole[] = ["admin", "manager", "technician", "requester"]

type UserFormValues = {
  email: string
  password: string
  displayName: string
  role: UserRole
  phone: string
  departmentId: string
  specialization: string
  isActive: "true" | "false"
}

type UserFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  user?: SpmsUser & { id: string }
}

function defaults(user?: SpmsUser & { id: string }): UserFormValues {
  return {
    email: user?.email ?? "",
    password: "",
    displayName: user?.displayName ?? "",
    role: user?.role ?? "technician",
    phone: user?.phone ?? "",
    departmentId: user?.departmentId ?? "",
    specialization: user?.specialization ?? "",
    isActive: user?.isActive === false ? "false" : "true",
  }
}

export function UserFormDialog({ open, onOpenChange, mode, user }: UserFormDialogProps) {
  const { spmsRole, user: actor } = useAuth()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<UserFormValues>({ defaultValues: defaults(user) })

  useEffect(() => {
    if (open) form.reset(defaults(user))
  }, [open, user, form])

  const onSubmit = form.handleSubmit(async (values) => {
    if (spmsRole !== "admin") {
      toast.error("هذه العملية للمسؤول فقط")
      return
    }
    setSubmitting(true)
    try {
      if (mode === "create") {
        if (!values.email.trim() || values.password.length < 6 || !values.displayName.trim()) {
          toast.error("أكمل البريد والاسم وكلمة مرور (٦ أحرف على الأقل)")
          return
        }
        const res = await createUserWithProfile({
          email: values.email,
          password: values.password,
          displayName: values.displayName,
          role: values.role,
          phone: values.phone,
          departmentId: values.departmentId,
          specialization: values.specialization,
          isActive: values.isActive === "true",
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (actor?.uid) {
          await appendActivityLog({
            actorUid: actor.uid,
            actionKey: "user.create",
            entityType: "user",
            entityId: res.uid,
            labelAr: `إنشاء مستخدم ${values.displayName} (${userRoleAr[values.role]})`,
          })
        }
        toast.success("تم إنشاء المستخدم")
        await queryClient.invalidateQueries({ queryKey: ["users"] })
        onOpenChange(false)
        return
      }

      if (!user) return
      const upd = await updateUser(spmsRole, user.id, {
        displayName: values.displayName.trim(),
        role: values.role,
        phone: values.phone.trim() || undefined,
        departmentId: values.departmentId.trim() || undefined,
        specialization: values.specialization.trim() || undefined,
        isActive: values.isActive === "true",
      })
      if (upd.error) {
        toast.error(upd.error)
        return
      }
      if (actor?.uid) {
        await appendActivityLog({
          actorUid: actor.uid,
          actionKey: "user.update",
          entityType: "user",
          entityId: user.id,
          labelAr: `تحديث مستخدم ${values.displayName} (${userRoleAr[values.role]})`,
        })
      }
      toast.success("تم حفظ التعديلات")
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "إضافة مستخدم" : "تعديل المستخدم"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "ينشئ حساب دخول وملف صلاحية مرتبطين — يمكن للمستخدم الدخول فوراً."
              : "تعديل الدور والحالة والبيانات. البريد وكلمة المرور لا يُعدّلان من هنا."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 pe-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">الاسم</Label>
              <Input id="displayName" {...form.register("displayName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                disabled={mode === "edit"}
                {...form.register("email")}
              />
            </div>
          </div>

          {mode === "create" ? (
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور المبدئية</Label>
              <Input id="password" type="text" dir="ltr" autoComplete="off" {...form.register("password")} />
              <p className="text-muted-foreground text-xs">٦ أحرف على الأقل — يستطيع المستخدم تغييرها لاحقاً.</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الدور</Label>
              <Controller
                name="role"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {userRoleAr[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Controller
                name="isActive"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">نشط</SelectItem>
                      <SelectItem value="false">موقوف</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">الهاتف (اختياري)</Label>
              <Input id="phone" dir="ltr" {...form.register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">القسم (اختياري)</Label>
              <Input id="departmentId" {...form.register("departmentId")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialization">التخصّص (اختياري)</Label>
            <Input id="specialization" {...form.register("specialization")} placeholder="مثل: كهرباء، هيدروليك" />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "يتم المعالجة…" : mode === "create" ? "إنشاء المستخدم" : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
