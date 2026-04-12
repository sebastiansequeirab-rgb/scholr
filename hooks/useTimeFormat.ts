'use client'

import { useTimeFormatContext } from '@/contexts/TimeFormatContext'

export function useTimeFormat() {
  return useTimeFormatContext()
}
