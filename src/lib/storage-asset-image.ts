import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"

import { storage } from "@/lib/firebase"

function extFromMimeOrName(file: File): string {
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  if (file.type === "image/gif") return "gif"
  const fromName = file.name.split(".").pop()
  return fromName?.match(/^[a-z0-9]+$/i) ? fromName.toLowerCase() : "jpg"
}

export async function uploadAssetPrimaryImage(assetId: string, file: File): Promise<string> {
  const ext = extFromMimeOrName(file)
  const path = `assets/${assetId}/primary.${ext}`
  const reference = ref(storage, path)
  await uploadBytes(reference, file, { contentType: file.type || undefined })
  return getDownloadURL(reference)
}

/** Best-effort delete of Storage object referenced by Firebase download URL */
export async function deleteAssetDownloadUrl(url: string): Promise<void> {
  try {
    if (!url.trim()) return
    await deleteObject(ref(storage, url))
  } catch {
    // ignore orphan files / mismatched emulator vs prod URLs
  }
}
