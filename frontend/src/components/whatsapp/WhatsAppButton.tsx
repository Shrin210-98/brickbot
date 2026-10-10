import { MessageCircle } from 'lucide-react'
import { useProfile } from '@/api/profile'
import { whatsappLink } from '@/lib/whatsapp'

// Floating click-to-chat button. Hidden until a WhatsApp number is configured.
export function WhatsAppButton() {
  const { data: profile } = useProfile()
  const href = profile ? whatsappLink(profile.whatsapp_number) : null
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <MessageCircle className="size-6" />
    </a>
  )
}
