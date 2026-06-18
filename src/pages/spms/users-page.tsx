import { MoreHorizontal, UserPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import RoleGate from "@/components/auth/role-gate"
import { UserFormDialog } from "@/components/users/user-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/auth-context"
import { useUsersQuery } from "@/hooks/use-spms-data"
import { formatArDate } from "@/lib/format"
import { userRoleAr } from "@/lib/labels-ar"
import type { SpmsUser } from "@/models/firestore"
import { updateUser } from "@/services/firestore/spms-service"
import { sendUserPasswordReset } from "@/services/firestore/user-admin-service"

type UserRow = SpmsUser & { id: string }

function UsersTable({ onEdit }: { onEdit: (u: UserRow) => void }) {
  const { data, isLoading, error } = useUsersQuery()
  const { spmsRole, user: actor } = useAuth()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)
  const isAdmin = spmsRole === "admin"

  async function resetPassword(row: UserRow) {
    if (!isAdmin) return
    setBusyId(row.id)
    try {
      const res = await sendUserPasswordReset(row.email)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`أُرسل رابط تعيين كلمة المرور إلى ${row.email}`)
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(row: UserRow) {
    if (!isAdmin) return
    if (row.id === actor?.uid) {
      toast.error("لا يمكنك تعطيل حسابك الحالي")
      return
    }
    setBusyId(row.id)
    try {
      const res = await updateUser("admin", row.id, { isActive: !row.isActive })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(row.isActive ? "تم تعطيل المستخدم" : "تم تفعيل المستخدم")
      await queryClient.invalidateQueries({ queryKey: ["users"] })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {error ? <p className="text-destructive text-sm">تعذر تحميل المستخدمين.</p> : null}

      <Card className="shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle>المستخدمون</CardTitle>
          <CardDescription>أدوار SPMS والحسابات النشطة</CardDescription>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-2 py-14 text-center">
              <p className="font-medium">لا يوجد مستخدمون</p>
              <p className="text-muted-foreground max-w-sm text-sm">أضف أول مستخدم لبدء التشغيل.</p>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>آخر تحديث</TableHead>
                    {isAdmin ? <TableHead className="w-12 text-end">إجراءات</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.displayName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm" dir="ltr">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{userRoleAr[u.role] ?? u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="secondary">نشط</Badge>
                        ) : (
                          <Badge variant="destructive">موقوف</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatArDate(u.updatedAt)}</TableCell>
                      {isAdmin ? (
                        <TableCell className="text-end">
                          <DropdownMenu dir="rtl">
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`إجراءات ${u.displayName}`}
                                disabled={busyId === u.id}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEdit(u)}>تعديل</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void resetPassword(u)}>
                                إرسال رابط كلمة المرور
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => void toggleActive(u)}>
                                {u.isActive ? "تعطيل" : "تفعيل"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export default function UsersPage() {
  const { spmsRole } = useAuth()
  const isAdmin = spmsRole === "admin"
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editing, setEditing] = useState<UserRow | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">المستخدمون</h1>
          <p className="text-muted-foreground mt-1 text-sm">إدارة الأدوار والوصول (للمدراء والمسؤولين)</p>
        </div>
        {isAdmin ? (
          <Button
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => {
              setFormMode("create")
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <UserPlus className="size-4" aria-hidden />
            إضافة مستخدم
          </Button>
        ) : null}
      </div>

      <RoleGate roles={["admin", "manager"]}>
        <UsersTable
          onEdit={(u) => {
            setFormMode("edit")
            setEditing(u)
            setFormOpen(true)
          }}
        />
      </RoleGate>

      <UserFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditing(null)
        }}
        mode={formMode}
        user={editing ?? undefined}
      />
    </div>
  )
}
