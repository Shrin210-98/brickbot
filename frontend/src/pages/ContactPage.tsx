import { useProfile } from '@/api/profile'
import { BackendDownFallback } from '@/components/errors/BackendDownFallback'
import { InquiryForm } from '@/components/inquiry/InquiryForm'
import { Card, CardContent } from '@/components/ui/card'
import { useBackendStatus } from '@/lib/backend-status'

export function ContactPage() {
  const { data: profile } = useProfile()
  const { isDown } = useBackendStatus()
  const fallback = <BackendDownFallback context="contact" />

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <title>{profile?.full_name ? `Contact ${profile.full_name} | BrickBot` : 'Contact | BrickBot'}</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Get in touch</h1>
        <p className="text-muted-foreground">
          Looking to buy, sell or rent? Leave your details and {profile?.full_name || 'we'} will get back to you.
        </p>
      </div>
      {/* Down already (the profile request failed), or found out on submit. */}
      {isDown ? (
        fallback
      ) : (
        <Card>
          <CardContent>
            <InquiryForm downFallback={fallback} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
