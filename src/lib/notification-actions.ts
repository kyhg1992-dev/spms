export function routeFromNotificationRefPath(refPath: string | undefined): string | null {
  if (!refPath?.trim()) return null

  const [collection, id] = refPath.split("/").filter(Boolean)
  if (!collection || !id) return null

  switch (collection) {
    case "workOrders":
      return `/dashboard/work-orders/${id}`
    case "assets":
      return `/dashboard/assets/${id}`
    case "pmSchedules":
      return `/dashboard/pm?pmScheduleId=${encodeURIComponent(id)}`
    case "notifications":
      return "/dashboard/notifications"
    default:
      return null
  }
}
