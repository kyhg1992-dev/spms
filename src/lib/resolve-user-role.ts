import type { UserRole } from "@/models/firestore"

export function inferUserRoleFromEmail(email: string | null | undefined): UserRole {
  const e = email?.toLowerCase() ?? ""
  if (e.includes("admin")) return "admin"
  if (e.includes("manager")) return "manager"
  if (e.includes("tech")) return "technician"
  return "requester"
}
