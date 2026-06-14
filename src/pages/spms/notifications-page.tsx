import { NotificationActions } from "@/components/notifications/notification-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useNotificationsQuery } from "@/hooks/use-spms-data"
import { formatArDateTime } from "@/lib/format"
import { notificationPriorityAr, notificationTypeAr } from "@/lib/labels-ar"

export default function NotificationsPage() {
  const { data, isLoading, error, isFetching } = useNotificationsQuery()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">الإشعارات</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          تنبيهات النظام وأوامر العمل والصيانة
          {isFetching && !isLoading ? (
            <span className="text-muted-foreground/80 ms-2 text-xs">(تحديث…)</span>
          ) : null}
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm">تعذر تحميل الإشعارات.</p>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>صندوق الوارد</CardTitle>
          <CardDescription>يُفلتر حسب المستخدم ما لم تكن صلاحية مدير</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-10 text-center">
              <p className="font-medium">لا توجد إشعارات</p>
              <p className="text-muted-foreground max-w-sm text-sm">ستظهر التنبيهات الجديدة هنا فور وصولها.</p>
            </div>
          ) : (
            <ScrollArea className="h-[min(60vh,520px)] pe-2">
              <ul className="flex flex-col gap-0">
                {(data ?? []).map((n, idx) => (
                  <li key={n.id}>
                    {idx > 0 ? <Separator className="my-3" /> : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-medium ${n.isRead ? "text-muted-foreground" : ""}`}>{n.title}</p>
                          <Badge variant="outline">{notificationTypeAr[n.type] ?? n.type}</Badge>
                          <Badge
                            variant={
                              n.priority === "critical"
                                ? "destructive"
                                : n.priority === "high"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs"
                          >
                            {notificationPriorityAr[n.priority] ?? n.priority}
                          </Badge>
                          {!n.isRead ? (
                            <Badge variant="default" className="text-xs">
                              غير مقروء
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">{n.body}</p>
                        {n.refPath ? (
                          <p className="text-muted-foreground/80 font-mono text-xs break-all">{n.refPath}</p>
                        ) : null}
                        <NotificationActions notification={n} />
                      </div>
                      <p className="text-muted-foreground shrink-0 text-xs tabular-nums sm:pt-0.5">
                        {formatArDateTime(n.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
