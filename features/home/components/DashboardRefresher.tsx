'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** Listens for student-relevant realtime changes from teacher actions and triggers router.refresh().
 *  Mount once near the top of /dashboard (or any student server page that should sync live). */
export function DashboardRefresher() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('student-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_grades' },   () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' },         () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' },   () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },      () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])
  return null
}
