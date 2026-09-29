export function relationID(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value && value.id != null) {
    return String((value as { id: number | string }).id)
  }
  return null
}
