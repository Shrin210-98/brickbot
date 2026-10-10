import { describe, expect, it } from 'vitest'
import { images } from '@/assets/images'

function leaves(node: unknown, path: string): Array<[string, unknown]> {
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, child]) => leaves(child, `${path}.${key}`))
  }
  return [[path, node]]
}

describe('images', () => {
  const entries = leaves(images, 'images')

  it('has at least one image', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it.each(entries)('%s is a non-empty http(s) URL', (_path, value) => {
    expect(typeof value).toBe('string')
    expect(value).not.toBe('')
    expect(value as string).toMatch(/^http/)
  })
})
