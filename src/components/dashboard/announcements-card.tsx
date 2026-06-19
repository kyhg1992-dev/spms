import { Megaphone, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useI18n } from "@/i18n/i18n"
import { formatArDate } from "@/lib/format"
import { MODULE_COLOR } from "@/lib/spms-colors"
import type { AnnouncementPriority } from "@/models/firestore"
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
} from "@/services/firestore/announcement-service"

const PRIORITY_STYLE: Record<AnnouncementPriority, string> = {
  normal: "bg-slate-100 text-slate-600",
  important: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
}

export function AnnouncementsCard() {
  const { t } = useI18n()
  const { spmsRole, user } = useAuth()
  const queryClient = useQueryClient()
  const isManager = spmsRole === "admin" || spmsRole === "manager"

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: listAnnouncements,
  })

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<AnnouncementPriority>("normal")
  const [busy, setBusy] = useState(false)

  const priorityLabel: Record<AnnouncementPriority, string> = {
    normal: t("ann.normal"),
    important: t("ann.important"),
    urgent: t("ann.urgent"),
  }

  async function publish() {
    if (!spmsRole || !user?.uid) return
    setBusy(true)
    try {
      const res = await createAnnouncement(spmsRole, { title, body, priority, createdByUid: user.uid })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t("ann.published"))
      setOpen(false)
      setTitle("")
      setBody("")
      setPriority("normal")
      await queryClient.invalidateQueries({ queryKey: ["announcements"] })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!spmsRole) return
    const res = await deleteAnnouncement(spmsRole, id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t("ann.deleted"))
    await queryClient.invalidateQueries({ queryKey: ["announcements"] })
  }

  return (
    <Card className="overflow-hidden rounded-xl border border-border/80 shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <span
              className="flex size-7 items-center justify-center rounded-md"
              style={{ color: MODULE_COLOR.notifications, backgroundColor: `${MODULE_COLOR.notifications}1a` }}
            >
              <Megaphone className="size-4" aria-hidden />
            </span>
            {t("ann.title")}
          </CardTitle>
          <CardDescription className="mt-1">{t("ann.subtitle")}</CardDescription>
        </div>
        {isManager ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> {t("ann.new")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t("ann.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {(data ?? []).map((a) => (
              <li key={a.id} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[a.priority]}`}>
                        {priorityLabel[a.priority]}
                      </span>
                    </div>
                    {a.body ? <p className="text-muted-foreground mt-1 whitespace-pre-wrap text-sm">{a.body}</p> : null}
                    <p className="text-muted-foreground mt-1 text-xs tabular-nums">{formatArDate(a.createdAt)}</p>
                  </div>
                  {isManager ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-destructive"
                      aria-label={t("common.delete")}
                      onClick={() => void remove(a.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ann.new")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-title">{t("ann.formTitle")}</Label>
              <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-body">{t("ann.formBody")}</Label>
              <Textarea id="ann-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("ann.priority")}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as AnnouncementPriority)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t("ann.normal")}</SelectItem>
                  <SelectItem value="important">{t("ann.important")}</SelectItem>
                  <SelectItem value="urgent">{t("ann.urgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={busy || !title.trim()} onClick={() => void publish()}>{t("ann.publish")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
