import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardList,
  Gauge,
  History,
  LayoutTemplate,
  LayoutDashboard,
  Menu,
  ScanLine,
  Search,
  Settings2,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link, NavLink, Outlet } from "react-router-dom"

import { RecordBreadcrumbs } from "@/components/layout/record-breadcrumbs"
import { GlobalCommand } from "@/components/layout/global-command"
import { useAuth } from "@/contexts/auth-context"
import { useCompanySettingsQuery } from "@/hooks/use-spms-data"
import { useI18n } from "@/i18n/i18n"
import { MODULE_COLOR } from "@/lib/spms-colors"
import { LanguageToggle } from "@/components/language-toggle"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { UserRole } from "@/models/firestore"

const navBase = "/dashboard"

type NavEntry = {
  to: string
  labelKey: string
  icon: typeof LayoutDashboard
  colorKey: string
  roles?: readonly UserRole[]
}

const NAV: NavEntry[] = [
  { to: `${navBase}`, labelKey: "nav.dashboard", icon: LayoutDashboard, colorKey: "dashboard" },
  { to: `${navBase}/scan`, labelKey: "nav.scan", icon: ScanLine, colorKey: "scan" },
  { to: `${navBase}/meter`, labelKey: "nav.meter", icon: Gauge, colorKey: "pm" },
  { to: `${navBase}/assets`, labelKey: "nav.assets", icon: Building2, colorKey: "assets" },
  { to: `${navBase}/work-orders`, labelKey: "nav.workOrders", icon: ClipboardList, colorKey: "workOrders" },
  { to: `${navBase}/maintenance-log`, labelKey: "nav.maintenanceLog", icon: History, colorKey: "maintenanceLog" },
  { to: `${navBase}/pm`, labelKey: "nav.pm", icon: CalendarCheck, colorKey: "pm" },
  { to: `${navBase}/maintenance-templates`, labelKey: "nav.templates", icon: LayoutTemplate, colorKey: "templates", roles: ["admin", "manager"] },
  { to: `${navBase}/notifications`, labelKey: "nav.notifications", icon: Bell, colorKey: "notifications" },
  { to: `${navBase}/reports`, labelKey: "nav.reports", icon: BarChart3, colorKey: "reports" },
  { to: `${navBase}/settings`, labelKey: "nav.settings", icon: Settings2, colorKey: "settings" },
  { to: `${navBase}/users`, labelKey: "nav.users", icon: Users, colorKey: "users", roles: ["admin", "manager"] },
]

function filterNav(role: UserRole | null): NavEntry[] {
  return NAV.filter((item) => {
    if (!item.roles) return true
    return role !== null && (item.roles as readonly UserRole[]).includes(role)
  })
}

function NavItems({ mobile = false }: { mobile?: boolean }) {
  const { spmsRole } = useAuth()
  const { t } = useI18n()
  const items = filterNav(spmsRole)

  return (
    <nav className={mobile ? "flex flex-col gap-1 px-2" : "flex flex-col gap-0.5 px-2"}>
      {items.map((entry) => {
        const Icon = entry.icon
        return (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.to === `${navBase}`}
            className={({ isActive }) =>
              [
                mobile ? "px-3 py-3" : "px-3 py-2.5",
                "flex items-center gap-3 rounded-lg text-sm transition-colors",
                "hover:bg-sidebar-accent/55",
                isActive
                  ? "border border-border/60 bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/80",
              ].join(" ")
            }
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-md"
              style={{
                color: MODULE_COLOR[entry.colorKey],
                backgroundColor: `${MODULE_COLOR[entry.colorKey]}1a`,
              }}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span>{t(entry.labelKey)}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function DashboardLayout() {
  const { profile, logout, user, spmsRole } = useAuth()
  const { t } = useI18n()
  const company = useCompanySettingsQuery()
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="bg-muted/25 text-foreground min-h-screen w-full [--sidebar-accent:theme(colors.sky.950/0.06)] [--sidebar-accent-foreground:theme(colors.sky.950)] dark:[--sidebar-accent:theme(colors.white/0.08)] dark:[--sidebar-accent-foreground:theme(colors.white)] [--sidebar-background:theme(colors.white)] dark:[--sidebar-background:theme(colors.background)]">
      <GlobalCommand footerSlot={<span className="text-muted-foreground">اختصار: Ctrl / ⌘ + K</span>} open={commandOpen} onOpenChange={setCommandOpen} role={spmsRole} />

      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside className="bg-sidebar-background border-sidebar-border text-sidebar-accent-foreground hidden w-72 shrink-0 border-s md:flex md:flex-col md:shadow-sm">
          <div className="from-primary/14 via-transparent to-accent/22 border-sidebar-border mb-px flex items-center gap-3 border-b bg-gradient-to-bl px-5 py-6">
            {company.data?.logoDataUrl ? (
              <img
                src={company.data.logoDataUrl}
                alt="لوجو الشركة"
                className="size-11 shrink-0 rounded-lg border bg-white object-contain p-1"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.2em]">
                Saudi Enterprise Ops
              </p>
              <h1 className="mt-1 truncate font-bold text-lg leading-tight tracking-tight md:text-xl">
                {company.data?.companyNameAr || "صيانة وقائية ذكية SPMS"}
              </h1>
            </div>
          </div>
          <ScrollArea className="min-h-[220px] flex-1 pt-5 pb-3">
            <NavItems />
          </ScrollArea>
          <Separator className="bg-border/70" />
          <div className="space-y-3 p-5">
            <div className="space-y-0.5">
              <p className="truncate font-semibold text-sm">{profile?.displayName ?? "مستخدم مخول"}</p>
              <p className="text-muted-foreground truncate text-xs">{user?.email ?? ""}</p>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => void logout()}>
              {t("header.logout")}
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="border-border sticky top-0 z-40 border-b bg-background/90 px-4 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3 md:gap-4">
              <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-8">
                <div className="flex items-center gap-2 md:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="القائمة">
                        <Menu className="size-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-72 p-0">
                      <SheetTitle className="sr-only">القائمة</SheetTitle>
                      <div className="border-sidebar-border bg-sidebar-background border-b px-5 py-4">
                        <p className="text-muted-foreground text-xs">التنقل</p>
                      </div>
                      <NavItems mobile />
                    </SheetContent>
                  </Sheet>
                  <div>
                    <p className="text-muted-foreground text-[11px]">SPMS Enterprise</p>
                    <span className="font-semibold">لوحة المعالجة</span>
                  </div>
                </div>
                <div className="hidden min-h-[40px] flex-col md:flex md:justify-center">
                  <p className="text-muted-foreground text-[11px]">إطار تنفيذي عربي</p>
                  <RecordBreadcrumbs />
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center gap-2 md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 border-dashed px-4 text-muted-foreground md:flex-none lg:min-w-[220px]"
                  onClick={() => setCommandOpen(true)}
                >
                  <Search className="size-4 opacity-75" aria-hidden />
                  {t("header.search")}
                  <kbd className="pointer-events-none hidden items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium lg:inline-flex">
                    Ctrl+K
                  </kbd>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 gap-2 px-4">
                      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-bold shadow-inner">
                        {(profile?.displayName ?? user?.email ?? "?")[0]?.toUpperCase() ?? ""}
                      </span>
                      <span className="hidden max-w-[120px] truncate text-xs font-semibold xl:inline">{profile?.displayName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className="w-52">
                    <DropdownMenuLabel>الملف الشخصي</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard/settings">الإعدادات</Link>
                    </DropdownMenuItem>
                    {(spmsRole === "admin" || spmsRole === "manager") && (
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/activity">سجل النشاط النظامي</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/about">عن المنصّة</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        void logout()
                      }}
                    >
                      خروج
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <LanguageToggle />
                <ModeToggle />
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 pb-12 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
