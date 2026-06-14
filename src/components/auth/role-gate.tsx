import type { ReactNode } from "react"

import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/models/firestore"

type RoleGateProps = {
  roles: readonly UserRole[]
  children: ReactNode
  fallback?: ReactNode
}

export default function RoleGate({ roles, children, fallback }: RoleGateProps) {
  const { spmsRole } = useAuth()

  if (!spmsRole || !roles.includes(spmsRole)) {
    return (
      <>
        {fallback ?? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-lg border p-8 text-center">
            <p className="font-medium text-foreground">غير مصرح بالوصول لهذا القسم.</p>
            <p className="text-muted-foreground text-sm">يجب امتلاك صلاحية مناسبة.</p>
          </div>
        )}
      </>
    )
  }

  return children
}
