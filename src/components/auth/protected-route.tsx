import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/models/firestore"

type ProtectedRouteProps = {
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, profile, spmsRole, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">جاري التحقق من الجلسة...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile || !spmsRole) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-muted-foreground">لم يتم تحميل ملف SPMS بعد.</p>
        <p className="text-xs text-muted-foreground">جرّب تسجيل الخروج ثم الدخول مجدداً.</p>
      </main>
    )
  }

  if (allowedRoles && !allowedRoles.includes(spmsRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
