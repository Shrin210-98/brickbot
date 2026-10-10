import { useId } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useCreateInquiry } from '@/api/inquiries'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { applyFieldErrors } from '@/lib/form-errors'
import {
  EMPTY_INQUIRY,
  INQUIRY_FIELDS,
  inquirySchema,
  type InquiryInput,
  type InquiryValues,
} from './inquiry-schema'

function serverErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'This listing is no longer available.'
    if (err.status === 429) return 'Too many inquiries sent. Please try again in a minute.'
  }
  return "Your inquiry couldn't be sent. Please try again."
}

export function InquiryForm({ listingSlug }: { listingSlug?: string }) {
  const id = useId()
  const createInquiry = useCreateInquiry()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryInput, unknown, InquiryValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: EMPTY_INQUIRY,
  })

  const onSubmit = async (values: InquiryValues) => {
    try {
      await createInquiry.mutateAsync({ ...values, listing_slug: listingSlug })
      reset()
    } catch (err) {
      if (!applyFieldErrors(err, setError, INQUIRY_FIELDS)) {
        setError('root.server', { message: serverErrorMessage(err) })
      }
    }
  }

  if (createInquiry.isSuccess) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Inquiry sent</AlertTitle>
        <AlertDescription>
          Thanks for reaching out. You'll hear back soon.
          <Button variant="link" className="h-auto p-0" onClick={() => createInquiry.reset()}>
            Send another
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input id={`${id}-name`} autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor={`${id}-phone`}>Phone</FieldLabel>
          <Input
            id={`${id}-phone`}
            type="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register('phone')}
          />
          <FieldError errors={[errors.phone]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor={`${id}-message`}>Message</FieldLabel>
          <Textarea id={`${id}-message`} rows={4} aria-invalid={!!errors.message} {...register('message')} />
          <FieldError errors={[errors.message]} />
        </Field>
        {errors.root?.server && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.server.message}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send inquiry'}
        </Button>
      </FieldGroup>
    </form>
  )
}
