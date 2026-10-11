import { useId, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isBackendDown } from '@/lib/backend-status'
import { useInquiryForm } from './useInquiryForm'

// downFallback, when given, replaces the form after a submit fails because the
// backend is unreachable. The typed values stay in form state.
export function InquiryForm({ listingSlug, downFallback }: { listingSlug?: string; downFallback?: ReactNode }) {
  const id = useId()
  const {
    form: {
      register,
      formState: { errors, isSubmitting },
    },
    submit,
    sent,
    sendAnother,
    submitError,
  } = useInquiryForm(listingSlug)

  if (downFallback && isBackendDown(submitError)) return downFallback

  if (sent) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Inquiry sent</AlertTitle>
        <AlertDescription>
          Thanks for reaching out. You'll hear back soon.
          <Button variant="link" className="h-auto p-0" onClick={sendAnother}>
            Send another
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input className="h-11 md:h-8" id={`${id}-name`} autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor={`${id}-phone`}>Phone</FieldLabel>
          <Input
            className="h-11 md:h-8"
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
            className="h-11 md:h-8"
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
        <Button type="submit" className="h-11 md:h-8" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send inquiry'}
        </Button>
      </FieldGroup>
    </form>
  )
}
