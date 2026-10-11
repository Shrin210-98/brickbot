import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useCreateInquiry } from '@/api/inquiries'
import { ApiError, isNetworkError } from '@/lib/api'
import { applyFieldErrors } from '@/lib/form-errors'
import { EMPTY_INQUIRY, INQUIRY_FIELDS, inquirySchema, type InquiryInput, type InquiryValues } from './inquiry-schema'

function serverErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'This listing is no longer available.'
    if (err.status === 429) return 'Too many inquiries sent. Please try again in a minute.'
  }
  if (isNetworkError(err) || (err instanceof ApiError && err.status >= 500)) {
    return "Can't reach the server. Your details are still here, so please try again."
  }
  return "Your inquiry couldn't be sent. Please try again."
}

// The inquiry form's state and submit logic, shared by its two looks:
// InquiryForm (cards on listing and contact pages) and HomeEnquiryForm.
// A 422 lands on the fields; any other failure sets root.server, and
// submitError keeps the raw error for components that format it themselves.
export function useInquiryForm(listingSlug?: string) {
  const createInquiry = useCreateInquiry()
  const form = useForm<InquiryInput, unknown, InquiryValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: EMPTY_INQUIRY,
  })

  const onSubmit = async (values: InquiryValues) => {
    try {
      await createInquiry.mutateAsync({ ...values, listing_slug: listingSlug })
      form.reset()
    } catch (err) {
      if (!applyFieldErrors(err, form.setError, INQUIRY_FIELDS)) {
        form.setError('root.server', { message: serverErrorMessage(err) })
      }
    }
  }

  return {
    form,
    submit: form.handleSubmit(onSubmit),
    sent: createInquiry.isSuccess,
    sendAnother: () => createInquiry.reset(),
    submitError: form.formState.errors.root?.server ? createInquiry.error : null,
  }
}
