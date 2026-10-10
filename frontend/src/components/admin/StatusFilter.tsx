import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ALL = 'all'

interface StatusFilterProps<S extends string> {
  statuses: readonly S[]
  labels: Record<S, string>
  value: S | undefined
  onChange: (value: S | undefined) => void
}

// Controlled by the page, which keeps the value in the URL.
export function StatusFilter<S extends string>({ statuses, labels, value, onChange }: StatusFilterProps<S>) {
  return (
    <Tabs value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : (v as S))}>
      <TabsList>
        <TabsTrigger value={ALL}>All</TabsTrigger>
        {statuses.map((s) => (
          <TabsTrigger key={s} value={s}>
            {labels[s]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
