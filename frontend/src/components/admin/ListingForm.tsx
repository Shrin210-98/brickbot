import { useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, type Control } from 'react-hook-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { LISTING_STATUSES } from '@/lib/admin-query'
import { ApiError } from '@/lib/api'
import { LISTING_STATUS_LABELS, PROPERTY_TYPE_LABELS, PURPOSE_LABELS } from '@/lib/format'
import { applyFieldErrors } from '@/lib/form-errors'
import type { ListingDetail, ListingWrite } from '@/types/api'
import {
  LISTING_FIELDS,
  listingSchema,
  listingToInput,
  PROPERTY_TYPES,
  PURPOSES,
  type ListingInput,
  type ListingValues,
} from './listing-schema'

type EnumName = 'purpose' | 'property_type' | 'status'

const toItems = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }))

const ENUM_ITEMS: Record<EnumName, { value: string; label: string }[]> = {
  purpose: toItems(PURPOSES, PURPOSE_LABELS),
  property_type: toItems(PROPERTY_TYPES, PROPERTY_TYPE_LABELS),
  status: toItems(LISTING_STATUSES, LISTING_STATUS_LABELS),
}

function EnumSelect({
  id,
  name,
  label,
  control,
}: {
  id: string
  name: EnumName
  label: string
  control: Control<ListingInput, unknown, ListingValues>
}) {
  const items = ENUM_ITEMS[name]
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select items={items} value={field.value} onValueChange={(v) => v !== null && field.onChange(v)}>
            <SelectTrigger id={id} className="w-full" onBlur={field.onBlur}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  )
}

function serverErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) return 'This listing no longer exists.'
  return "The listing couldn't be saved. Please try again."
}

interface ListingFormProps {
  listing?: ListingDetail
  submitLabel: string
  onSubmit: (values: ListingWrite) => Promise<unknown>
}

export function ListingForm({ listing, submitLabel, onSubmit }: ListingFormProps) {
  const id = useId()
  const [saved, setSaved] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ListingInput, unknown, ListingValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: listingToInput(listing),
  })

  const submit = async (values: ListingValues) => {
    setSaved(false)
    try {
      await onSubmit(values)
      setSaved(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('slug', { message: 'This slug is already used by another listing' })
      } else if (!applyFieldErrors(err, setError, LISTING_FIELDS)) {
        setError('root.server', { message: serverErrorMessage(err) })
      }
    }
  }

  const text = (name: 'title' | 'slug' | 'city' | 'locality' | 'address', label: string, description?: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
      <Input id={`${id}-${name}`} aria-invalid={!!errors[name]} {...register(name)} />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={[errors[name]]} />
    </Field>
  )

  const number = (name: 'price' | 'bedrooms' | 'bathrooms' | 'area', label: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
      <Input id={`${id}-${name}`} inputMode="numeric" aria-invalid={!!errors[name]} {...register(name)} />
      <FieldError errors={[errors[name]]} />
    </Field>
  )

  return (
    <form onSubmit={handleSubmit(submit)} onChange={() => setSaved(false)} noValidate>
      <FieldGroup>
        {text('title', 'Title')}
        {text('slug', 'Slug', listing ? 'Changing it breaks existing links.' : 'Leave empty to generate it from the title.')}
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          <Textarea
            id={`${id}-description`}
            rows={6}
            aria-invalid={!!errors.description}
            {...register('description')}
          />
          <FieldError errors={[errors.description]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <EnumSelect id={`${id}-purpose`} name="purpose" label="Purpose" control={control} />
          <EnumSelect id={`${id}-property_type`} name="property_type" label="Type" control={control} />
          <EnumSelect id={`${id}-status`} name="status" label="Status" control={control} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {number('price', 'Price')}
          {number('bedrooms', 'Bedrooms')}
          {number('bathrooms', 'Bathrooms')}
          {number('area', 'Area')}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {text('city', 'City')}
          {text('locality', 'Locality')}
        </div>
        {text('address', 'Address')}

        <Controller
          control={control}
          name="featured"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id={`${id}-featured`} checked={field.value} onCheckedChange={(checked) => {
                field.onChange(checked)
                setSaved(false)
              }} />
              <FieldLabel htmlFor={`${id}-featured`}>Featured on the home page</FieldLabel>
            </Field>
          )}
        />

        {errors.root?.server && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.server.message}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
          {saved && (
            <span className="text-sm text-muted-foreground" role="status">
              Saved
            </span>
          )}
        </div>
      </FieldGroup>
    </form>
  )
}
