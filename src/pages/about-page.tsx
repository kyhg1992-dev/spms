import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">حول المشروع</h1>
      <p className="text-muted-foreground">
        تم تفعيل React Router مع دعم الاتجاه من اليمين إلى اليسار وخط Cairo.
      </p>
      <Link to="/" className={buttonVariants({ variant: "outline" })}>
        العودة للرئيسية
      </Link>
    </main>
  )
}
