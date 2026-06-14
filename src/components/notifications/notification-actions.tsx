import { Archive, Eye, EyeOff, ExternalLink } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { routeFromNotificationRefPath } from "@/lib/notification-actions"
import type { Notification } from "@/models/firestore"
import {
  archiveOperationalNotification,
  markOperationalNotificationRead,
} from "@/services/firestore/spms-service"

type NotificationActionsProps = {
  notification: Notification & { id: string }
  dir?: "rtl" | "ltr"
  language?: "ar" | "en"
}

const labels = {
  ar: {
    read: "تعليم كمقروء",
    unread: "تعليم كغير مقروء",
    archive: "أرشفة",
    open: "فتح السجل",
    noLink: "لا يوجد سجل مرتبط.",
    done: "تم تحديث الإشعار.",
    missingAuth: "يتطلب الإجراء مستخدما نشطا وصلاحية SPMS.",
  },
  en: {
    read: "Mark Read",
    unread: "Mark Unread",
    archive: "Archive",
    open: "Open Record",
    noLink: "No linked record is available.",
    done: "Notification updated.",
    missingAuth: "A signed-in SPMS user and role are required.",
  },
}

export function NotificationActions({
  notification,
  dir = "rtl",
  language = "ar",
}: NotificationActionsProps) {
  const text = labels[language]
  const { spmsRole, user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const linkedRoute = routeFromNotificationRefPath(notification.refPath)

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  async function run(action: () => Promise<{ error: string | null }>) {
    if (!spmsRole || !user?.uid) {
      toast.error(text.missingAuth)
      return
    }
    const result = await action()
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(text.done)
    await refresh()
  }

  return (
    <div dir={dir} className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          void run(() =>
            markOperationalNotificationRead(spmsRole!, notification.id, !notification.isRead, user!.uid)
          )
        }
      >
        {notification.isRead ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {notification.isRead ? text.unread : text.read}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          void run(() =>
            archiveOperationalNotification(spmsRole!, {
              notificationId: notification.id,
              archiveReason: "Archived from notification inbox",
              actorUid: user!.uid,
            })
          )
        }
      >
        <Archive className="size-4" />
        {text.archive}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!linkedRoute}
        title={linkedRoute ? undefined : text.noLink}
        onClick={() => {
          if (!linkedRoute) {
            toast.info(text.noLink)
            return
          }
          navigate(linkedRoute)
        }}
      >
        <ExternalLink className="size-4" />
        {text.open}
      </Button>
    </div>
  )
}
