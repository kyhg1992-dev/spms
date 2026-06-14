import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/contexts/auth-context"
import { deleteAssetDownloadUrl } from "@/lib/storage-asset-image"
import type { Asset } from "@/models/firestore"
import { deleteAsset } from "@/services/firestore/spms-service"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: (Asset & { id: string }) | null
  onDeleted?: () => void
}

export function AssetDeleteDialog({ open, onOpenChange, asset, onDeleted }: Props) {
  const { spmsRole } = useAuth()
  const [busy, setBusy] = useState(false)

  const handleDelete = async () => {
    if (!asset || !spmsRole) return
    setBusy(true)
    try {
      if (asset.imageUrl) await deleteAssetDownloadUrl(asset.imageUrl)
      const res = await deleteAsset(spmsRole, asset.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("تم حذف الأصل")
      onOpenChange(false)
      onDeleted?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف الأصل؟</AlertDialogTitle>
          <AlertDialogDescription>
            {asset ? (
              <>
                سيتم حذف «{asset.assetName}» ({asset.assetCode}) نهائياً من Firestore. لا يمكن التراجع عن هذا الإجراء.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void handleDelete()
            }}
          >
            {busy ? "جاري الحذف…" : "حذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
