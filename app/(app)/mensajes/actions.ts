'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function markMessageReadAction(messageId: string) {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('student_id', user.id)
    .is('read_at', null)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/mensajes')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function markAllMessagesReadAction() {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('student_id', user.id)
    .is('read_at', null)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/mensajes')
  revalidatePath('/dashboard')
  return { ok: true }
}

const ReplySchema = z.object({
  teacherId: z.string().uuid(),
  courseId:  z.string().uuid(),
  body:      z.string().trim().min(1).max(20_000),
})

export async function sendStudentReplyAction(input: { teacherId: string; courseId: string; body: string }): Promise<{ ok: boolean; error?: string }> {
  const parsed = ReplySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireUser()

  // Validate enrollment in the target course (RLS would block but the error is opaque)
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('subject_id, subjects:subject_id(teacher_id)')
    .eq('student_id', user.id)
    .eq('subject_id', parsed.data.courseId)
    .eq('status', 'active')
    .maybeSingle()

  const enroll = enrollment as { subjects: { teacher_id: string | null } | null } | null
  if (!enroll || !enroll.subjects || enroll.subjects.teacher_id !== parsed.data.teacherId) {
    return { ok: false, error: 'No estás inscripto en este curso o el profesor no coincide.' }
  }

  const { error } = await supabase.from('messages').insert({
    teacher_id: parsed.data.teacherId,
    student_id: user.id,
    course_id:  parsed.data.courseId,
    sender_id:  user.id,
    subject:    null,
    body:       parsed.data.body,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/mensajes')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function markStudentThreadReadAction(input: { teacherId: string; courseId: string | null }): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser()
  let query = supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('teacher_id', input.teacherId)
    .eq('student_id', user.id)
    .neq('sender_id', user.id)
    .is('read_at', null)
  query = input.courseId === null ? query.is('course_id', null) : query.eq('course_id', input.courseId)
  const { error } = await query
  if (error) return { ok: false, error: error.message }
  revalidatePath('/mensajes')
  revalidatePath('/dashboard')
  return { ok: true }
}
