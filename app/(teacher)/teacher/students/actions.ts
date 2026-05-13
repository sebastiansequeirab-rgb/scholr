'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

async function requireTeacher() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'teacher') redirect('/dashboard')
  return { supabase, user }
}

const MessageSchema = z.object({
  courseId:    z.string().uuid().nullable(),
  studentIds:  z.array(z.string().uuid()).min(1),
  subject:     z.string().trim().min(1).max(160),
  body:        z.string().trim().min(1).max(20_000),
})

/** Send an internal message (one row per recipient) to selected students. No email — appears in /mensajes. */
export async function sendBulkMessageAction(input: { courseId: string | null; studentIds: string[]; subject: string; body: string }): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const parsed = MessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireTeacher()

  if (parsed.data.courseId) {
    const { data: subj } = await supabase.from('subjects').select('id, teacher_id').eq('id', parsed.data.courseId).single()
    if (!subj || (subj as { teacher_id: string }).teacher_id !== user.id) return { ok: false, error: 'No tienes permiso para este curso' }
  }

  const rows = parsed.data.studentIds.map(sid => ({
    teacher_id: user.id,
    student_id: sid,
    course_id:  parsed.data.courseId,
    sender_id:  user.id,
    subject:    parsed.data.subject,
    body:       parsed.data.body,
  }))

  const { error, count } = await supabase.from('messages').insert(rows, { count: 'exact' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/students')
  return { ok: true, sent: count ?? rows.length }
}
