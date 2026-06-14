import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { UserRole } from "@/models/firestore"

const LINKS: { roles?: readonly UserRole[]; title: string; path: string; group: string }[] = [
  { title: "الرئيسية — مؤشرات المؤسسة", path: "/dashboard", group: "التنقل" },
  { title: "إدارة الأصول والعدادات", path: "/dashboard/assets", group: "العمليات" },
  {
    title: "أوامر العمل",
    path: "/dashboard/work-orders",
    group: "العمليات",
  },
  { title: "الصيانة الوقائية", path: "/dashboard/pm", group: "العمليات" },
  { title: "مركز الإشعارات", path: "/dashboard/notifications", group: "التواصل" },
  { title: "سجل النشاط", path: "/dashboard/activity", group: "المراقبة", roles: ["admin", "manager"] },
  { title: "التقارير والتحليلات", path: "/dashboard/reports", group: "المراقبة" },
  { title: "الإعدادات المؤسسية", path: "/dashboard/settings", group: "التكوين" },
  {
    title: "إدارة المستخدمين والأدوار",
    path: "/dashboard/users",
    group: "التكوين",
    roles: ["admin", "manager"],
  },
]

type GlobalCommandProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  role: UserRole | null
  footerSlot?: ReactNode
}

export function GlobalCommand({ open, onOpenChange, role, footerSlot }: GlobalCommandProps) {
  const navigate = useNavigate()

  const filtered = LINKS.filter((l) => {
    if (!l.roles || !role) return true
    return l.roles.includes(role)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl" showClose>
        <div className="sr-only flex flex-col">
          <DialogTitle>بحث وتنفيذ تنقل ذكي</DialogTitle>
          <DialogDescription>اوصل إلى أدوات SPMS بسرعة.</DialogDescription>
        </div>
        <Command loop className="border-0">
          <CommandInput placeholder="ابحث عن قسم أو اكتب الاسم العربي أو المسار…" />
          <CommandList className="min-h-[240px]">
            <CommandEmpty>لا توجد نتيجة مطابقة.</CommandEmpty>
            <CommandGroup heading="القوائم">
              {filtered.map((item) => (
                <CommandItem
                  key={item.title}
                  keywords={[item.title, item.path]}
                  value={`${item.path} ${item.title}`}
                  onSelect={() => {
                    navigate(item.path)
                    onOpenChange(false)
                  }}
                >
                  <span className="font-medium">{item.title}</span>
                  <span dir="ltr" className="text-muted-foreground ms-auto truncate text-[11px]">
                    {item.path}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {footerSlot ? <div className="border-t bg-muted/30 px-4 py-2 text-xs">{footerSlot}</div> : null}
      </DialogContent>
    </Dialog>
  )
}
