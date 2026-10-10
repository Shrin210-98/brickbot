import { useRef, useState, type ChangeEvent } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { useDeleteMedia, useReorderMedia, useReplaceMedia, useUploadMedia } from '@/api/admin-listings'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import type { ListingMedia } from '@/types/api'
import { ConfirmDelete } from './ConfirmDelete'

// Mirrors the upload rules of POST /api/admin/listings/{id}/media.
const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 10 << 20

function checkFile(file: File): string | null {
  if (!ACCEPT.split(',').includes(file.type)) return `${file.name}: only JPEG, PNG or WebP images are accepted.`
  if (file.size > MAX_BYTES) return `${file.name}: images must be 10 MB or smaller.`
  return null
}

function uploadError(file: File, err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 413) return `${file.name}: images must be 10 MB or smaller.`
    if (err.status === 422 && err.fields?.file) return `${file.name}: ${err.fields.file}.`
  }
  return `${file.name}: upload failed.`
}

// Picks files from a hidden input. The input is cleared so the same file can be picked again.
function useFilePicker(onPick: (files: File[]) => void, multiple = false) {
  const ref = useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={ref}
      type="file"
      accept={ACCEPT}
      multiple={multiple}
      className="hidden"
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const files = [...(e.target.files ?? [])]
        e.target.value = ''
        if (files.length) onPick(files)
      }}
    />
  )
  return { input, open: () => ref.current?.click() }
}

export function MediaManager({ listingId, media }: { listingId: string; media: ListingMedia[] }) {
  const upload = useUploadMedia(listingId)
  const replace = useReplaceMedia(listingId)
  const reorder = useReorderMedia(listingId)
  const remove = useDeleteMedia(listingId)
  const [errors, setErrors] = useState<string[]>([])
  const [uploading, setUploading] = useState(0)
  const [replacing, setReplacing] = useState<string | null>(null)

  const busy = uploading > 0 || replace.isPending || reorder.isPending || remove.isPending

  // Uploads one at a time so images keep the order they were picked in.
  const uploadFiles = async (files: File[]) => {
    const problems: string[] = []
    const valid = files.filter((f) => {
      const problem = checkFile(f)
      if (problem) problems.push(problem)
      return !problem
    })
    setErrors(problems)
    setUploading(valid.length)
    for (const file of valid) {
      try {
        await upload.mutateAsync(file)
      } catch (err) {
        problems.push(uploadError(file, err))
        setErrors([...problems])
      }
      setUploading((n) => n - 1)
    }
  }

  const replacePicker = useFilePicker(async ([file]) => {
    const mediaId = replacing
    if (!mediaId) return
    const problem = checkFile(file)
    if (problem) return setErrors([problem])
    setErrors([])
    try {
      await replace.mutateAsync({ mediaId, file })
    } catch (err) {
      setErrors([uploadError(file, err)])
    } finally {
      setReplacing(null)
    }
  })
  const uploadPicker = useFilePicker(uploadFiles, true)

  const move = (index: number, by: -1 | 1) => {
    const ids = media.map((m) => m.id)
    ;[ids[index], ids[index + by]] = [ids[index + by], ids[index]]
    setErrors([])
    reorder.mutate({ media_ids: ids }, { onError: () => setErrors(['Reordering failed. The list has been refreshed.']) })
  }

  return (
    <div className="flex flex-col gap-4">
      {uploadPicker.input}
      {replacePicker.input}

      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet. The first photo is used as the cover.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((m, i) => (
            <li key={m.id} className="flex flex-col gap-2 rounded-lg border p-2">
              <div className="relative">
                <img src={m.url} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full rounded-md object-cover" />
                {i === 0 && <Badge className="absolute top-2 left-2">Cover</Badge>}
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move earlier"
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move later"
                    disabled={busy || i === media.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Replace photo"
                    disabled={busy}
                    onClick={() => {
                      setReplacing(m.id)
                      replacePicker.open()
                    }}
                  >
                    <RefreshCw className={replacing === m.id && replace.isPending ? 'animate-spin' : undefined} />
                  </Button>
                  <ConfirmDelete
                    title="Delete this photo?"
                    description="The file is removed from the server. This can't be undone."
                    onConfirm={() => remove.mutateAsync(m.id)}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Delete photo" disabled={busy}>
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Button variant="outline" className="self-start" disabled={busy} onClick={uploadPicker.open}>
        <ImagePlus data-icon="inline-start" />
        {uploading > 0 ? `Uploading… (${uploading} left)` : 'Add photos'}
      </Button>
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 10 MB each.</p>
    </div>
  )
}
