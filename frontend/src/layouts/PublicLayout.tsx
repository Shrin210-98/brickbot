import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { ChatFab } from '@/components/chat/ChatFab'

export function PublicLayout() {
  // Home lays out its own full-width section bands; other pages get the content column.
  const isHome = useLocation().pathname === '/'

  // A page's fixed bottom bar ([data-bottom-bar], below lg) would cover the end of the footer.
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground max-lg:has-[[data-bottom-bar]]:pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
      <Header />
      <main className={isHome ? 'flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8'}>
        <Outlet />
      </main>
      <Footer />
      <ChatFab />
    </div>
  )
}
