import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import {
  fetchActivityLogs,
  fetchAssets,
  fetchCompanySettings,
  fetchMaintenanceTemplates,
  fetchMeterReadings,
  fetchNotificationsForUser,
  fetchPMSchedules,
  fetchUsers,
  fetchWorkOrders,
  subscribeAssets,
  subscribeNotificationsForUser,
  subscribePMSchedules,
  subscribeWorkOrders,
} from "@/api/spms-firestore"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/models/firestore"

function canReadAllNotifications(role: UserRole | null): boolean {
  return role === "admin" || role === "manager"
}

function canBrowseUsers(role: UserRole | null): boolean {
  return role === "admin" || role === "manager"
}

function canBrowseActivity(role: UserRole | null): boolean {
  return role === "admin" || role === "manager"
}

export function useAssetsQuery(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["assets"],
    queryFn: fetchAssets,
    enabled,
  })

  useEffect(() => {
    if (!enabled) return
    return subscribeAssets((rows) => queryClient.setQueryData(["assets"], rows), undefined)
  }, [enabled, queryClient])

  return query
}

export function useWorkOrdersQuery(enabled = true) {
  const queryClient = useQueryClient()
  const { user, spmsRole } = useAuth()
  const uid = user?.uid ?? ""
  const scopedEnabled = enabled && !!uid && !!spmsRole

  const query = useQuery({
    queryKey: ["workOrders", uid, spmsRole],
    queryFn: () => fetchWorkOrders(uid, spmsRole),
    enabled: scopedEnabled,
  })

  useEffect(() => {
    if (!scopedEnabled) return
    return subscribeWorkOrders(
      (rows) => queryClient.setQueryData(["workOrders", uid, spmsRole], rows),
      undefined,
      uid,
      spmsRole
    )
  }, [scopedEnabled, queryClient, spmsRole, uid])

  return query
}

export function usePMSchedulesQuery(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["pmSchedules"],
    queryFn: fetchPMSchedules,
    enabled,
  })

  useEffect(() => {
    if (!enabled) return
    return subscribePMSchedules((rows) => queryClient.setQueryData(["pmSchedules"], rows), undefined)
  }, [enabled, queryClient])

  return query
}

export function useMaintenanceTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: ["maintenanceTemplates"],
    queryFn: fetchMaintenanceTemplates,
    enabled,
  })
}

export function useNotificationsQuery() {
  const queryClient = useQueryClient()
  const { user, spmsRole } = useAuth()
  const uid = user?.uid ?? ""
  const canAll = canReadAllNotifications(spmsRole)
  const enabled = !!uid && !!spmsRole

  const query = useQuery({
    queryKey: ["notifications", uid, canAll],
    queryFn: () => fetchNotificationsForUser(uid, canAll),
    enabled,
  })

  useEffect(() => {
    if (!enabled) return
    return subscribeNotificationsForUser(
      uid,
      canAll,
      (rows) => queryClient.setQueryData(["notifications", uid, canAll], rows),
      undefined
    )
  }, [canAll, enabled, queryClient, uid])

  return query
}

export function useUsersQuery() {
  const { spmsRole } = useAuth()
  const ok = canBrowseUsers(spmsRole)

  return useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: ok,
  })
}

export function useMeterReadingsQuery(assetId: string | undefined) {
  return useQuery({
    queryKey: ["meterReadings", assetId],
    queryFn: () => fetchMeterReadings(assetId!),
    enabled: !!assetId,
  })
}

export function useCompanySettingsQuery() {
  return useQuery({
    queryKey: ["companySettings"],
    queryFn: fetchCompanySettings,
  })
}

export function useActivityLogsQuery(enabledOverride?: boolean) {
  const { spmsRole } = useAuth()
  const enabled =
    typeof enabledOverride === "boolean" ? enabledOverride : canBrowseActivity(spmsRole)

  return useQuery({
    queryKey: ["activityLogs"],
    queryFn: () => fetchActivityLogs(300),
    enabled,
  })
}
