import { useProfile } from '@/api/profile'
import { InquiryForm } from '@/components/inquiry/InquiryForm'
import { Card, CardContent } from '@/components/ui/card'

export function ContactPage() {
  const { data: profile } = useProfile()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <title>{profile?.name ? `Contact ${profile.name} | BrickBot` : 'Contact | BrickBot'}</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Get in touch</h1>
        <p className="text-muted-foreground">
          Looking to buy, sell or rent? Leave your details and {profile?.name || 'we'} will get back to you.
        </p>
      </div>
      <Card>
        <CardContent>
          <InquiryForm />
        </CardContent>
      </Card>
    </div>
  )
}
