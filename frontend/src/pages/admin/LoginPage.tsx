import { useId } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useLogin } from '@/api/auth'
import { BackendDownFallback } from '@/components/errors/BackendDownFallback'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { isBackendDown } from '@/lib/backend-status'
import { applyFieldErrors } from '@/lib/form-errors'

// Mirrors the POST /api/auth/login validator tags. The password is never trimmed.
const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email').max(254)),
  password: z.string().min(1, 'Password is required').max(200, 'Password must be at most 200 characters'),
})

type LoginInput = z.input<typeof loginSchema>
type LoginValues = z.output<typeof loginSchema>

// "Wrong password" and "server unreachable" must never look alike, so the
// unreachable case gets BackendDownFallback instead. 429 matches the login
// rate limit (5 per 15 minutes, docs/api.md).
function serverErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Wrong email or password.'
    if (err.status === 429) return 'Too many attempts. Try again in 15 minutes.'
  }
  return "Couldn't log in. Please try again."
}

export function LoginPage() {
  const id = useId()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    try {
      await login.mutateAsync(values)
      navigate(from, { replace: true })
    } catch (err) {
      // Rendered from login.error below the form.
      if (isBackendDown(err)) return
      if (!applyFieldErrors(err, setError, ['email', 'password'])) {
        setError('root.server', { message: serverErrorMessage(err) })
      }
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <title>Admin login | BrickBot</title>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" /> Admin login
          </CardTitle>
          <CardDescription>Sign in to manage listings and inquiries.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
                <Input
                  id={`${id}-email`}
                  type="email"
                  autoComplete="username"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor={`${id}-password`}>Password</FieldLabel>
                <Input
                  id={`${id}-password`}
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              {errors.root?.server && (
                <Alert variant="destructive">
                  <AlertDescription>{errors.root.server.message}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </FieldGroup>
          </form>
          {isBackendDown(login.error) && (
            <div className="mt-4">
              <BackendDownFallback context="admin" compact />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
