'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireTeacher() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'teacher') redirect('/dashboard')
  return { supabase, user }
}

const ReplySchema = z.object({
  studentId: z.string().uuid(),
  courseId:  z.string().uuid(),
  body:      z.string().trim().min(1).max(20_000),
})

export async function sendChatMessageAction(input: { studentId: string; courseId: string; body: string }): Promise<{ ok: boolean; error?: string }> {
  const parsed = ReplySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireTeacher()

  const { data: subj } = await supabase
    .from('subjects')
    .select('id, teacher_id')
    .eq('id', parsed.data.courseId)
    .single()
  if (!subj || (subj as { teacher_id: string }).teacher_id !== user.id) {
    return { ok: false, error: 'No tienes permiso para este curso' }
  }

  const { error } = await supabase.from('messages').insert({
    teacher_id: user.id,
    student_id: parsed.data.studentId,
    course_id:  parsed.data.courseId,
    sender_id:  user.id,
    subject:    null,
    body:       parsed.data.body,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/teacher/mensajes')
  return { ok: true }
}

export async function markThreadReadAction(input: { studentId: string; courseId: string }): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireTeacher()
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('teacher_id', user.id)
    .eq('student_id', input.studentId)
    .eq('course_id', input.courseId)
    .neq('sender_id', user.id)
    .is('read_at', null)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/teacher/mensajes')
  return { ok: true }
}
