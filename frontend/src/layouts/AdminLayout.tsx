import { Building2, LogOut } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useLogout, useMe } from '@/api/auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// The only admin auth guard: every /admin page renders inside it.
export function AdminLayout() {
  const { data: me, isPending, error } = useMe()
  const logout = useLogout()
  const location = useLocation()

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Alert variant="destructive">
          <AlertTitle>Couldn't check your session</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!me) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <Building2 className="size-5" />
            Admin
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{me.email}</span>
            <Button variant="ghost" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>
              <LogOut data-icon="inline-start" /> Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
