import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { ListingDetailPage } from '@/pages/ListingDetailPage'
import { ListingsPage } from '@/pages/ListingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/listings', element: <ListingsPage /> },
      { path: '/listings/:slug', element: <ListingDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
