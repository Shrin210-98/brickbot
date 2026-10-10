import { useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useUpdateInquiry } from '@/api/admin-inquiries'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { INQUIRY_STATUSES } from '@/lib/admin-query'
import { INQUIRY_STATUS_LABELS } from '@/lib/format'
import { applyFieldErrors } from '@/lib/form-errors'
import type { Inquiry } from '@/types/api'

// Mirrors the PATCH /api/admin/inquiries/{id} validator tags. Both fields are always sent.
const triageSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  admin_note: z.string().trim().max(5000, 'Note must be at most 5000 characters'),
})

type TriageInput = z.input<typeof triageSchema>
type TriageValues = z.output<typeof triageSchema>

const STATUS_ITEMS = INQUIRY_STATUSES.map((value) => ({ value, label: INQUIRY_STATUS_LABELS[value] }))

export function InquiryTriageForm({ inquiry }: { inquiry: Inquiry }) {
  const id = useId()
  const update = useUpdateInquiry(inquiry.id)
  const [saved, setSaved] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TriageInput, unknown, TriageValues>({
    resolver: zodResolver(triageSchema),
    defaultValues: { status: inquiry.status, admin_note: inquiry.admin_note },
  })

  const submit = async (values: TriageValues) => {
    setSaved(false)
    try {
      const updated = await update.mutateAsync(values)
      reset({ status: updated.status, admin_note: updated.admin_note })
      setSaved(true)
    } catch (err) {
      if (!applyFieldErrors(err, setError, ['status', 'admin_note'])) {
        setError('root.server', { message: "Couldn't save. Please try again." })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
              <Select
                items={STATUS_ITEMS}
                value={field.value}
                onValueChange={(v) => {
                  if (v === null) return
                  field.onChange(v)
                  setSaved(false)
                }}
              >
                <SelectTrigger id={`${id}-status`} className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Field data-invalid={!!errors.admin_note}>
          <FieldLabel htmlFor={`${id}-note`}>Private note</FieldLabel>
          <Textarea
            id={`${id}-note`}
            rows={5}
            placeholder="Called back, site visit on Saturday…"
            aria-invalid={!!errors.admin_note}
            {...register('admin_note', { onChange: () => setSaved(false) })}
          />
          <FieldError errors={[errors.admin_note]} />
        </Field>
        {errors.root?.server && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.server.message}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          {saved && (
            <span className="text-sm text-muted-foreground" role="status">
              Saved
            </span>
          )}
        </div>
      </FieldGroup>
    </form>
  )
}
