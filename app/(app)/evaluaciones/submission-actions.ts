'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const SubmitSchema = z.object({
  examId:  z.string().uuid(),
  content: z.string().trim().max(20_000).optional().default(''),
})

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

/** Student creates a submission for a teacher-assigned exam. Returns { ok } and revalidates relevant paths. */
export async function createSubmissionAction(input: { examId: string; content: string }) {
  const parsed = SubmitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireUser()

  // Resolve courseId from exam
  const { data: exam } = await supabase
    .from('exams')
    .select('id, subject_id, assigned_by')
    .eq('id', parsed.data.examId)
    .single()
  if (!exam) return { ok: false, error: 'Examen no encontrado' }
  if ((exam as { assigned_by: string | null }).assigned_by == null) {
    return { ok: false, error: 'Este examen no admite entregas' }
  }

  // Verify enrollment
  const { data: enroll } = await supabase
    .from('enrollments')
    .select('id')
    .eq('subject_id', (exam as { subject_id: string }).subject_id)
    .eq('student_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!enroll) return { ok: false, error: 'No estás inscrito en este curso' }

  // Upsert submission (unique on exam_id + student_id)
  const { error } = await supabase
    .from('submissions')
    .upsert({
      course_id:    (exam as { subject_id: string }).subject_id,
      student_id:   user.id,
      exam_id:      parsed.data.examId,
      status:       'pending_review',
      content:      parsed.data.content || null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'exam_id,student_id' })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/evaluaciones')
  revalidatePath('/dashboard')
  return { ok: true }
}
