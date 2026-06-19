import { MoreHorizontal, Plus, Search, Trash2, Upload } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { AssetDeleteDialog } from "@/components/assets/asset-delete-dialog"
import { AssetFormDialog } from "@/components/assets/asset-form-dialog"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/contexts/auth-context"
import { useI18n, useLabels } from "@/i18n/i18n"
import { useAssetsQuery, useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import { assetCategoryAr } from "@/lib/asset-categories"
import { formatArDate } from "@/lib/format"
import { deriveNextServiceForAsset } from "@/lib/maintenance-next-service"
import { serviceLevelColor } from "@/lib/spms-colors"
import type { Asset, AssetStatus, MaintenanceSequenceTemplate } from "@/models/firestore"
import { bulkDeleteAssets } from "@/services/firestore/spms-service"
import { canAccess } from "@/services/firestore/permissions"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

const PAGE_SIZE = 10

type AssetRow = Asset & { id: string }

export default function AssetsListPage() {
  const { spmsRole } = useAuth()
  const { t } = useI18n()
  const L = useLabels()
  const { data, isLoading, error, isFetching } = useAssetsQuery()
  const templates = useMaintenanceTemplatesQuery()
  const templatesById = useMemo(
    () =>
      new Map<string, MaintenanceSequenceTemplate & { id: string }>(
        (templates.data ?? []).map((t) => [t.id, t])
      ),
    [templates.data]
  )

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | AssetStatus>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editing, setEditing] = useState<AssetRow | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<AssetRow | null>(null)

  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const canCreate = spmsRole && canAccess(spmsRole, "assets", "create")
  const canUpdate = spmsRole && canAccess(spmsRole, "assets", "update")
  const canDelete = spmsRole && canAccess(spmsRole, "assets", "delete")

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runBulkDelete() {
    if (!spmsRole || selected.size === 0) return
    setBulkBusy(true)
    try {
      const res = await bulkDeleteAssets(spmsRole, [...selected])
      if (res.error) {
        toast.error(res.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["assets"] })
      toast.success(`${t("common.delete")}: ${res.data ?? 0}`)
      setSelected(new Set())
      setBulkConfirm(false)
    } finally {
      setBulkBusy(false)
    }
  }

  const filtered = useMemo(() => {
    let rows = (data ?? []).slice()
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.assetCode.toLowerCase().includes(q) ||
          r.assetName.toLowerCase().includes(q) ||
          r.serialNo.toLowerCase().includes(q) ||
          r.brand.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q)
      )
    }
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
    if (categoryFilter) rows = rows.filter((r) => r.category === categoryFilter)
    return rows
  }, [data, search, statusFilter, categoryFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageSlice = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const categoriesOnFile = useMemo(() => {
    const s = new Set<string>()
    ;(data ?? []).forEach((r) => s.add(r.category))
    return [...s].sort()
  }, [data])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">{t("assets.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("assets.subtitle")}
            {isFetching && !isLoading ? <span className="ms-2 text-xs">({t("common.syncing")})</span> : null}
          </p>
        </div>
        {canCreate ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/dashboard/assets/import">
                <Upload className="size-4" aria-hidden />
                {t("assets.importExcel")}
              </Link>
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setFormMode("create")
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("assets.add")}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm">{t("assets.loadError")}</p> : null}

      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="space-y-4 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{t("assets.tableTitle")}</CardTitle>
              <CardDescription>{t("assets.tableSubtitle")}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative min-w-[200px] flex-1 lg:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                className="ps-9"
                placeholder={t("assets.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Select
              value={statusFilter === "" ? "all" : statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : (v as AssetStatus))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full lg:w-[160px]" size="sm">
                <SelectValue placeholder={t("common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                <SelectItem value="active">{L.assetStatus("active")}</SelectItem>
                <SelectItem value="maintenance">{L.assetStatus("maintenance")}</SelectItem>
                <SelectItem value="retired">{L.assetStatus("retired")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter === "" ? "all" : categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v === "all" ? "" : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full lg:w-[180px]" size="sm">
                <SelectValue placeholder={t("common.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allCategories")}</SelectItem>
                {categoriesOnFile.map((c) => (
                  <SelectItem key={c} value={c}>
                    {assetCategoryAr(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-2 py-14 text-center">
              <p className="font-medium">لا توجد أصول مسجَّلة بعد</p>
              <p className="text-muted-foreground max-w-sm text-sm">ابدأ بإضافة أصل أو تشغيل بذور البيانات التجريبية.</p>
              {canCreate ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setFormMode("create")
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  إضافة أصل
                </Button>
              ) : null}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="font-medium">لا توجد نتائج مطابقة</p>
              <p className="text-muted-foreground text-sm">جرّب تغيير عبارات البحث أو التصفيات.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setStatusFilter("")
                  setCategoryFilter("")
                  setPage(1)
                }}
              >
                مسح المرشّحات
              </Button>
            </div>
          ) : (
            <>
              {canDelete ? (
                <div className="flex flex-wrap items-center gap-2 pb-3">
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set(filtered.map((r) => r.id)))}>
                    {t("assets.selectAll")} ({filtered.length})
                  </Button>
                  {selected.size > 0 ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                        {t("assets.clearSelection")}
                      </Button>
                      <Button variant="destructive" size="sm" className="gap-1" onClick={() => setBulkConfirm(true)}>
                        <Trash2 className="size-4" /> {t("assets.deleteSelected")} ({selected.size})
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className="-mx-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canDelete ? <TableHead className="w-8"></TableHead> : null}
                      <TableHead className="w-[88px]">{t("col.image")}</TableHead>
                      <TableHead>{t("col.code")}</TableHead>
                      <TableHead>{t("col.name")}</TableHead>
                      <TableHead>{t("col.category")}</TableHead>
                      <TableHead>{t("col.location")}</TableHead>
                      <TableHead>{t("col.status")}</TableHead>
                      <TableHead>{t("col.nextService")}</TableHead>
                      <TableHead>{t("col.lastUpdate")}</TableHead>
                      {(canUpdate || canDelete) && <TableHead className="w-12 text-end">{t("common.actions")}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageSlice.map((row) => (
                      <TableRow key={row.id}>
                        {canDelete ? (
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selected.has(row.id)}
                              onChange={() => toggleSelect(row.id)}
                              aria-label={`تحديد ${row.assetName}`}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          {row.imageUrl ? (
                            <img
                              src={row.imageUrl}
                              alt=""
                              className="size-10 rounded-md border object-cover"
                            />
                          ) : (
                            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md text-[10px]">
                              —
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">{row.assetCode}</TableCell>
                        <TableCell>
                          <Link
                            to={`/dashboard/assets/${row.id}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {row.assetName}
                          </Link>
                        </TableCell>
                        <TableCell>{assetCategoryAr(row.category)}</TableCell>
                        <TableCell>{row.location}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{L.assetStatus(row.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const ns = deriveNextServiceForAsset({ asset: row, templatesById })
                            if (!ns) return <span className="text-muted-foreground text-xs">—</span>
                            const c = serviceLevelColor(ns.nextCode)
                            return (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                style={{ backgroundColor: c.bg, color: c.fg }}
                                title={ns.isDue ? "مستحقة" : `بعد ${String(Math.round(ns.remainingUntilDue))}`}
                              >
                                {ns.nextLabel}
                                {ns.isDue ? " •" : ""}
                              </span>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatArDate(row.updatedAt)}</TableCell>
                        {canUpdate || canDelete ? (
                          <TableCell className="text-end">
                            <DropdownMenu dir="rtl">
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`إجراءات ${row.assetName}`}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/dashboard/assets/${row.id}`}>{t("common.details")}</Link>
                                </DropdownMenuItem>
                                {canUpdate ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setFormMode("edit")
                                      setEditing(row)
                                      setFormOpen(true)
                                    }}
                                  >
                                    {t("common.edit")}
                                  </DropdownMenuItem>
                                ) : null}
                                {canDelete ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => {
                                        setDeleting(row)
                                        setDeleteOpen(true)
                                      }}
                                    >
                                      {t("common.delete")}
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 pt-6 sm:flex-row">
                <p className="text-muted-foreground text-sm tabular-nums">
                  {t("assets.pageOf")} {currentPage} {t("assets.of")} {totalPages} — {filtered.length} {t("assets.totalAfterFilter")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("common.prev")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AssetFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditing(null)
        }}
        mode={formMode}
        asset={editing ?? undefined}
      />

      <AssetDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o)
          if (!o) setDeleting(null)
        }}
        asset={deleting}
      />

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assets.bulkDeleteTitle")} ({selected.size})</AlertDialogTitle>
            <AlertDialogDescription>
              {t("assets.bulkDeleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              onClick={(e) => {
                e.preventDefault()
                void runBulkDelete()
              }}
            >
              {bulkBusy ? t("common.deleting") : t("assets.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
