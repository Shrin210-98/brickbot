import { Building2, LogOut } from 'lucide-react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLogout, useMe } from '@/api/auth'
import { ApiErrorState } from '@/components/errors/ApiErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm font-medium transition-colors hover:text-foreground', isActive ? 'text-foreground' : 'text-muted-foreground')

// The only admin auth guard: every /admin page renders inside it.
export function AdminLayout() {
  const { data: me, isPending, error, refetch } = useMe()
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
        <ApiErrorState error={error} title="Couldn't check your session" onRetry={() => void refetch()} />
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
          <div className="flex items-center gap-6">
            <Link to="/admin" className="flex items-center gap-2 font-semibold">
              <Building2 className="size-5" />
              Admin
            </Link>
            <nav className="flex items-center gap-4">
              <NavLink to="/admin/inquiries" className={navLinkClass}>
                Inquiries
              </NavLink>
              <NavLink to="/admin/listings" className={navLinkClass}>
                Listings
              </NavLink>
              <Link to="/" target="_blank" className={navLinkClass({ isActive: false })}>
                View site
              </Link>
            </nav>
          </div>
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
