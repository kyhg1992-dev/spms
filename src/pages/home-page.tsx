import { Link } from "react-router-dom"

import { ModeToggle } from "@/components/mode-toggle"
import { buttonVariants } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-6 px-4 text-center">
      <ModeToggle />
      <h1 className="text-4xl font-bold">مرحبا بك في SPMS</h1>
      <p className="text-muted-foreground">واجهة جاهزة بـ Tailwind + shadcn + RTL</p>
      <Link to="/about" className={buttonVariants()}>
        الانتقال إلى صفحة حول
      </Link>
    </main>
  )
}
