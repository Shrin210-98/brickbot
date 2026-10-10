import { useMe } from '@/api/auth'

// Placeholder until the admin listing and inquiry pages exist.
export function AdminHomePage() {
  const { data: me } = useMe()

  return (
    <div className="flex flex-col gap-2">
      <title>Admin | BrickBot</title>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="text-muted-foreground">Signed in as {me?.email}. Listing and inquiry management is coming soon.</p>
    </div>
  )
}
