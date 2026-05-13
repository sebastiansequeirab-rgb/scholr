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

const AnnouncementSchema = z.object({
  courseId: z.string().uuid(),
  title:    z.string().trim().min(1).max(120),
  content:  z.string().trim().max(8000).optional().default(''),
  priority: z.enum(['normal', 'urgent']).default('normal'),
})

export async function createAnnouncementAction(input: { courseId: string; title: string; content: string; priority: 'normal' | 'urgent' }) {
  const parsed = AnnouncementSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireTeacher()

  const { data: subj } = await supabase.from('subjects').select('id, teacher_id').eq('id', parsed.data.courseId).single()
  if (!subj || (subj as { teacher_id: string }).teacher_id !== user.id) return { ok: false, error: 'No tienes permiso para este curso' }

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      subject_id: parsed.data.courseId,
      teacher_id: user.id,
      title:      parsed.data.title,
      content:    parsed.data.content || null,
      priority:   parsed.data.priority,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/announcements')
  revalidatePath('/teacher')
  revalidatePath(`/teacher/courses/${parsed.data.courseId}`)
  revalidatePath('/dashboard') // student dashboard sees announcements
  return { ok: true, id: (data as { id: string }).id }
}

export async function updateAnnouncementAction(announcementId: string, input: { title: string; content: string; priority: 'normal' | 'urgent' }) {
  const { supabase, user } = await requireTeacher()
  const parsed = AnnouncementSchema.pick({ title: true, content: true, priority: true }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { error } = await supabase
    .from('announcements')
    .update({ title: parsed.data.title, content: parsed.data.content || null, priority: parsed.data.priority })
    .eq('id', announcementId)
    .eq('teacher_id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/announcements')
  return { ok: true }
}

export async function deleteAnnouncementAction(announcementId: string) {
  const { supabase, user } = await requireTeacher()
  const { error } = await supabase.from('announcements').delete().eq('id', announcementId).eq('teacher_id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/announcements')
  revalidatePath('/teacher')
  return { ok: true }
}
