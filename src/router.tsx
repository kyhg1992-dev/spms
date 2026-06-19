import { lazy, Suspense, type ComponentType } from "react"
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom"

import ProtectedRoute from "@/components/auth/protected-route"
import DashboardLayout from "@/components/dashboard/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { RootRedirect } from "@/router/root-redirect"
import HomePage from "@/pages/home-page"
import LoginPage from "@/pages/login-page"

/** Wrap a lazily-loaded page in a Suspense boundary so route chunks load on demand. */
function lazyPage(factory: () => Promise<{ default: ComponentType }>) {
  const Component = lazy(factory)
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl p-6">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <Component />
    </Suspense>
  )
}

const ALL_USER_ROLES = ["admin", "manager", "technician", "requester"] as const

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/home", element: <HomePage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute allowedRoles={[...ALL_USER_ROLES]} />,
    children: [
      { path: "/about", element: lazyPage(() => import("@/pages/about-page")) },
      { path: "/scan/:assetId", element: lazyPage(() => import("@/pages/spms/scan-asset-page")) },
      { path: "/print/asset/:assetId", element: lazyPage(() => import("@/pages/spms/assets/asset-card-print-page")) },
      { path: "/print/asset-report/:assetId", element: lazyPage(() => import("@/pages/spms/assets/asset-report-print-page")) },
      { path: "/print/maintenance-log", element: lazyPage(() => import("@/pages/spms/maintenance-log-print-page")) },
      { path: "/print/sticker/:assetId", element: lazyPage(() => import("@/pages/spms/assets/asset-sticker-print-page")) },
      { path: "/print/work-order/:workOrderId", element: lazyPage(() => import("@/pages/spms/work-orders/work-order-card-print-page")) },
      { path: "/print/execution/:workOrderId", element: lazyPage(() => import("@/pages/spms/work-orders/execution-summary-print-page")) },
      {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
          { index: true, element: lazyPage(() => import("@/pages/spms/dashboard-home-page")) },
          { path: "scan", element: lazyPage(() => import("@/pages/spms/scan-home-page")) },
          {
            path: "assets",
            element: <Outlet />,
            children: [
              { index: true, element: lazyPage(() => import("@/pages/spms/assets/assets-list-page")) },
              { path: "import", element: lazyPage(() => import("@/pages/spms/assets/assets-import-page")) },
              { path: ":assetId", element: lazyPage(() => import("@/pages/spms/assets/asset-detail-page")) },
            ],
          },
          {
            path: "work-orders",
            element: <Outlet />,
            children: [
              { index: true, element: lazyPage(() => import("@/pages/spms/work-orders/work-orders-list-page")) },
              { path: ":workOrderId", element: lazyPage(() => import("@/pages/spms/work-orders/work-order-detail-page")) },
            ],
          },
          { path: "pm", element: lazyPage(() => import("@/pages/spms/pm-schedules-page")) },
          { path: "maintenance-log", element: lazyPage(() => import("@/pages/spms/maintenance-log-page")) },
          {
            path: "maintenance-templates",
            element: <Outlet />,
            children: [
              { index: true, element: lazyPage(() => import("@/pages/spms/maintenance/templates-list-page")) },
              { path: "new", element: lazyPage(() => import("@/pages/spms/maintenance/template-editor-page")) },
              { path: ":templateId", element: lazyPage(() => import("@/pages/spms/maintenance/template-editor-page")) },
            ],
          },
          { path: "notifications", element: lazyPage(() => import("@/pages/spms/notifications-page")) },
          { path: "reports", element: lazyPage(() => import("@/pages/spms/reports-page")) },
          { path: "activity", element: lazyPage(() => import("@/pages/spms/activity-log-page")) },
          { path: "settings", element: lazyPage(() => import("@/pages/spms/settings-page")) },
          { path: "users", element: lazyPage(() => import("@/pages/spms/users-page")) },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [{ path: "/admin", element: <Navigate to="/dashboard/users" replace /> }],
  },
])
