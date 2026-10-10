import { z } from 'zod'

// Mirrors the backend's phoneRE (backend/internal/httpx/validate.go).
const PHONE_RE = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/

const CONTACT_REQUIRED = 'Enter a phone number or an email'

// Mirrors the POST /api/inquiries validator tags. Strings are trimmed like the API does.
export const inquirySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || PHONE_RE.test(v), 'Enter a valid phone number'),
    email: z
      .string()
      .trim()
      .max(254, 'Email must be at most 254 characters')
      .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email'),
    message: z.string().trim().max(2000, 'Message must be at most 2000 characters'),
  })
  .superRefine((v, ctx) => {
    if (v.phone || v.email) return
    ctx.addIssue({ code: 'custom', path: ['phone'], message: CONTACT_REQUIRED })
    ctx.addIssue({ code: 'custom', path: ['email'], message: CONTACT_REQUIRED })
  })

export type InquiryInput = z.input<typeof inquirySchema>
export type InquiryValues = z.output<typeof inquirySchema>

export const INQUIRY_FIELDS = ['name', 'phone', 'email', 'message'] as const

export const EMPTY_INQUIRY: InquiryInput = { name: '', phone: '', email: '', message: '' }
