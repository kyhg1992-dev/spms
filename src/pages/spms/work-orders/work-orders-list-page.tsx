import { StickyNote } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WorkOrderPendingBadge } from "@/components/work-orders/work-order-pending-badge"
import { useI18n, useLabels } from "@/i18n/i18n"
import { useAssetsQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate } from "@/lib/format"

const TERMINAL = new Set(["closed", "cancelled"])

export default function WorkOrdersListPage() {
  const { t } = useI18n()
  const L = useLabels()
  const { data, isLoading, error } = useWorkOrdersQuery()
  const assets = useAssetsQuery()
  const [view, setView] = useState<"pending" | "done">("pending")

  const assetNameById = new Map((assets.data ?? []).map((a) => [a.id, a.assetName]))

  const counts = useMemo(() => {
    const all = data ?? []
    const done = all.filter((w) => TERMINAL.has(String(w.status))).length
    return { pending: all.length - done, done }
  }, [data])

  const rows = useMemo(
    () =>
      (data ?? []).filter((w) =>
        view === "done" ? TERMINAL.has(String(w.status)) : !TERMINAL.has(String(w.status))
      ),
    [data, view]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight md:text-3xl">{t("wo.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("wo.subtitle")}</p>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{t("wo.loadError")}</p> : null}

      <Card className="overflow-hidden rounded-xl border-border/80 shadow-md">
        <CardHeader className="gap-3">
          <div>
            <CardTitle>{t("wo.logTitle")}</CardTitle>
            <CardDescription>{t("wo.logSubtitle")}</CardDescription>
          </div>
          <div className="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5">
            <Button
              size="sm"
              variant={view === "pending" ? "default" : "ghost"}
              className="h-8 gap-1.5"
              onClick={() => setView("pending")}
            >
              {t("wo.viewPending")} <Badge variant="secondary" className="tabular-nums">{counts.pending}</Badge>
            </Button>
            <Button
              size="sm"
              variant={view === "done" ? "default" : "ghost"}
              className="h-8 gap-1.5"
              onClick={() => setView("done")}
            >
              {t("wo.viewDone")} <Badge variant="secondary" className="tabular-nums">{counts.done}</Badge>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-2 py-14 text-center">
              <p className="font-medium">{t("wo.empty")}</p>
              <p className="text-muted-foreground max-w-sm text-sm">{t("wo.emptyHint")}</p>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("col.titleCol")}</TableHead>
                    <TableHead>{t("col.asset")}</TableHead>
                    <TableHead>{t("col.status")}</TableHead>
                    <TableHead>{t("col.pending")}</TableHead>
                    <TableHead>{t("col.priority")}</TableHead>
                    <TableHead>{t("col.due")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="max-w-[220px]">
                        <span className="inline-flex items-center gap-1.5">
                          {wo.observationNotes?.trim() || wo.executionPhotos?.length || wo.extraItems?.length ? (
                            <StickyNote className="size-3.5 shrink-0 text-amber-600" aria-label={t("exec.hasNotes")} />
                          ) : null}
                          <Link
                            to={`/dashboard/work-orders/${wo.id}`}
                            className="text-primary font-semibold underline-offset-4 hover:underline"
                          >
                            {wo.title}
                          </Link>
                        </span>
                        <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{wo.description}</p>
                      </TableCell>
                      <TableCell>{assetNameById.get(wo.assetId) ?? `${wo.assetId.slice(0, 8)}…`}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{L.woStatus(String(wo.status))}</Badge>
                      </TableCell>
                      <TableCell>
                        <WorkOrderPendingBadge workOrder={wo} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            wo.priority === "critical"
                              ? "destructive"
                              : wo.priority === "high"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {L.priority(wo.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatArDate(wo.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
