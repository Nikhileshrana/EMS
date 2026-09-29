export type RecordingQuality = '480' | '720'

export const DEFAULT_RECORDING_QUALITY: RecordingQuality = '720'

export const RECORDING_QUALITY_OPTIONS = [
  { value: '480' as const, label: '480p (smaller files)' },
  { value: '720' as const, label: '720p (highest)' },
]

export const RECORDING_QUALITY = {
  '480': {
    width: 854,
    height: 480,
    videoBitsPerSecond: 600_000,
    label: '480p',
  },
  '720': {
    width: 1280,
    height: 720,
    videoBitsPerSecond: 1_200_000,
    label: '720p',
  },
} as const

export function parseRecordingQuality(value: unknown): RecordingQuality {
  return value === '480' ? '480' : DEFAULT_RECORDING_QUALITY
}
