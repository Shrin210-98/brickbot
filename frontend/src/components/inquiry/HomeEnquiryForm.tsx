import { useId, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useProfile } from '@/api/profile'
import { ApiErrorState } from '@/components/errors/ApiErrorState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { whatsappLink } from '@/lib/whatsapp'
import { useInquiryForm } from './useInquiryForm'

// Square fields for this form only; the rest of the site keeps its rounding.
const FIELD =
  'w-full min-h-11 rounded-none border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm'

function FormField({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// Home's "Reach out" enquiry form: the editorial, square look of the same
// inquiry logic InquiryForm uses on the listing and contact pages.
export function HomeEnquiryForm() {
  const id = useId()
  const { data: profile } = useProfile()
  const whatsapp = profile ? whatsappLink(profile.whatsapp_number) : null
  const {
    form: {
      register,
      formState: { errors, isSubmitting },
    },
    submit,
    sent,
    sendAnother,
    submitError,
  } = useInquiryForm()

  // aria-invalid plus a pointer to the field's error text.
  const invalid = (name: keyof typeof errors) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${id}-${name}-error` } : {}

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <span className="h-10 w-1 shrink-0 bg-primary" aria-hidden />
          <h2 className="font-display text-3xl/[1.2] md:text-[2.5rem]/[1.2]">Reach out</h2>
        </div>
        <p className="pl-5 text-muted-foreground">
          Have a question or want to see a listing?
          <br />I reply personally.
        </p>
      </div>

      {sent ? (
        <Alert className="rounded-none">
          <CheckCircle2 />
          <AlertTitle>Enquiry sent</AlertTitle>
          <AlertDescription>
            Thanks for reaching out. You'll hear back soon.
            <Button variant="link" className="h-auto p-0" onClick={sendAnother}>
              Send another
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-6 md:pl-5">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField id={`${id}-name`} label="Name" error={errors.name?.message}>
              <input id={`${id}-name`} autoComplete="name" className={FIELD} {...invalid('name')} {...register('name')} />
            </FormField>
            <FormField id={`${id}-phone`} label="Phone" error={errors.phone?.message}>
              <input
                id={`${id}-phone`}
                type="tel"
                autoComplete="tel"
                className={FIELD}
                {...invalid('phone')}
                {...register('phone')}
              />
            </FormField>
          </div>
          <FormField id={`${id}-email`} label="Email (optional)" error={errors.email?.message}>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              className={FIELD}
              {...invalid('email')}
              {...register('email')}
            />
          </FormField>
          <FormField id={`${id}-message`} label="Message" error={errors.message?.message}>
            <textarea
              id={`${id}-message`}
              rows={4}
              className={cn(FIELD, 'resize-y')}
              {...invalid('message')}
              {...register('message')}
            />
          </FormField>

          {submitError !== null && (
            <ApiErrorState compact error={submitError} onRetry={() => void submit()} className="rounded-none" />
          )}

          <div className="flex flex-col gap-4 md:flex-row-reverse md:items-center md:justify-between">
            <Button type="submit" className="h-11 w-full rounded-none px-8 text-base md:w-auto" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send Enquiry'}
            </Button>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center text-primary underline-offset-4 hover:underline md:justify-start"
              >
                or reach me on WhatsApp →
              </a>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
