import type { MouseEvent } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

// Page numbers to show: first, last, and a window around the current page.
function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount))
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap' as const, p] : [p]))
}

interface ListingPaginationProps {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  onPageChange: (page: number) => void
}

export function ListingPagination({ page, pageCount, hrefFor, onPageChange }: ListingPaginationProps) {
  if (pageCount <= 1) return null

  const go = (target: number) => (e: MouseEvent) => {
    e.preventDefault()
    onPageChange(target)
  }

  return (
    <Pagination>
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious className="h-11 min-w-11 md:h-8" href={hrefFor(page - 1)} onClick={go(page - 1)} />
          </PaginationItem>
        )}
        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink className="size-11 md:size-8" href={hrefFor(p)} isActive={p === page} onClick={go(p)}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        {page < pageCount && (
          <PaginationItem>
            <PaginationNext className="h-11 min-w-11 md:h-8" href={hrefFor(page + 1)} onClick={go(page + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
