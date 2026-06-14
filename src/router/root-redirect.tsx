import { Navigate } from "react-router-dom"

import { useAuth } from "@/contexts/auth-context"

export function RootRedirect() {
  const { user, profile, spmsRole, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </main>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!profile || !spmsRole) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-muted-foreground">لم يتم تحميل ملف المستخدم.</p>
      </main>
    )
  }
  // Technicians land on the barcode scanner (their primary task); others on the board.
  return <Navigate to={spmsRole === "technician" ? "/dashboard/scan" : "/dashboard"} replace />
}
