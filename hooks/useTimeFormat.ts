'use client'

import { useTimeFormatContext } from '@/components/layout/TimeFormatContext'

export function useTimeFormat() {
  return useTimeFormatContext()
}
