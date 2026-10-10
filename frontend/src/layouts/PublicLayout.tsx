import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton'

export function PublicLayout() {
  // Home lays out its own full-width section bands; other pages get the content column.
  const isHome = useLocation().pathname === '/'

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Header />
      <main className={isHome ? 'flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8'}>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
