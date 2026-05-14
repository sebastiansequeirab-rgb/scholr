'use client'

import { createContext, useContext, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSemesterProgressAction } from '@/app/(app)/dashboard/actions'

interface WeekContextValue {
  currentWeek: number | null
  semesterWeeks: number | null
  pending: boolean
  setWeek: (current: number, total: number) => Promise<{ ok: boolean; error?: string }>
}

const WeekContext = createContext<WeekContextValue>({
  currentWeek: null,
  semesterWeeks: null,
  pending: false,
  setWeek: async () => ({ ok: false, error: 'not initialized' }),
})

export function WeekProvider({
  initial,
  children,
}: {
  initial: { currentWeek: number | null; semesterWeeks: number | null }
  children: React.ReactNode
}) {
  const router = useRouter()
  const [currentWeek, setCurrentWeek] = useState<number | null>(initial.currentWeek)
  const [semesterWeeks, setSemesterWeeks] = useState<number | null>(initial.semesterWeeks)
  const [pending, startTransition] = useTransition()

  const setWeek = useCallback(
    (current: number, total: number) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        startTransition(async () => {
          const r = await updateSemesterProgressAction({ current_week: current, semester_weeks: total })
          if (r.ok) {
            setCurrentWeek(current)
            setSemesterWeeks(total)
            router.refresh()
          }
          resolve(r)
        })
      }),
    [router],
  )

  return (
    <WeekContext.Provider value={{ currentWeek, semesterWeeks, pending, setWeek }}>
      {children}
    </WeekContext.Provider>
  )
}

export function useWeek() {
  return useContext(WeekContext)
}
