import { Link } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

export default function AdminPage() {
  const { user, logout } = useAuth()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold">لوحة الأدمن</h1>
      <p className="text-muted-foreground">Admin: {user?.email}</p>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonVariants({ variant: "outline" })} to="/dashboard">
          لوحة المستخدم
        </Link>
        <Button variant="destructive" onClick={() => void logout()}>
          تسجيل الخروج
        </Button>
      </div>
    </main>
  )
}
