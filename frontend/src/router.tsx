import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminLayout } from '@/layouts/AdminLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { AdminInquiriesPage } from '@/pages/admin/AdminInquiriesPage'
import { AdminInquiryPage } from '@/pages/admin/AdminInquiryPage'
import { AdminListingEditPage } from '@/pages/admin/AdminListingEditPage'
import { AdminListingNewPage } from '@/pages/admin/AdminListingNewPage'
import { AdminListingsPage } from '@/pages/admin/AdminListingsPage'
import { LoginPage } from '@/pages/admin/LoginPage'
import { ContactPage } from '@/pages/ContactPage'
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
      { path: '/contact', element: <ContactPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/inquiries" replace /> },
      { path: 'inquiries', element: <AdminInquiriesPage /> },
      { path: 'inquiries/:id', element: <AdminInquiryPage /> },
      { path: 'listings', element: <AdminListingsPage /> },
      { path: 'listings/new', element: <AdminListingNewPage /> },
      { path: 'listings/:id', element: <AdminListingEditPage /> },
    ],
  },
])
