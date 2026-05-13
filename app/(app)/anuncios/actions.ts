'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function markAnnouncementReadAction(announcementId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('announcement_reads')
    .upsert(
      { announcement_id: announcementId, student_id: user.id },
      { onConflict: 'announcement_id,student_id', ignoreDuplicates: true },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/anuncios')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function markAllAnnouncementsReadAction(announcementIds: string[]): Promise<{ ok: boolean; error?: string }> {
  if (announcementIds.length === 0) return { ok: true }
  const { supabase, user } = await requireUser()
  const rows = announcementIds.map(id => ({ announcement_id: id, student_id: user.id }))
  const { error } = await supabase
    .from('announcement_reads')
    .upsert(rows, { onConflict: 'announcement_id,student_id', ignoreDuplicates: true })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/anuncios')
  revalidatePath('/dashboard')
  return { ok: true }
}
