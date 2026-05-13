'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { generateAccessCode } from '@/lib/accent'
import { COURSE_ACCENTS } from '@/types'

const CourseSchema = z.object({
  name:     z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  semester: z.string().trim().max(40).optional().default(''),
  credits:  z.coerce.number().int().min(0).max(20).optional().default(0),
  accent:   z.enum(COURSE_ACCENTS as unknown as [string, ...string[]]).default('blue'),
  icon:     z.string().trim().max(40).default('menu_book'),
})

export type CourseFormState = {
  ok?: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof z.infer<typeof CourseSchema>, string>>
  id?: string
  access_code?: string
}

async function requireTeacher() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'teacher') redirect('/dashboard')
  return { supabase, user }
}

export async function createCourseAction(_prev: CourseFormState | undefined, formData: FormData): Promise<CourseFormState> {
  const parsed = CourseSchema.safeParse({
    name:     formData.get('name'),
    semester: formData.get('semester') || '',
    credits:  formData.get('credits') || 0,
    accent:   formData.get('accent') || 'blue',
    icon:     formData.get('icon') || 'menu_book',
  })
  if (!parsed.success) {
    const fieldErrors: CourseFormState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof CourseSchema>
      fieldErrors[key] = issue.message
    }
    return { ok: false, error: 'Revisa los campos', fieldErrors }
  }
  const { name, semester, credits, accent, icon } = parsed.data

  const { supabase, user } = await requireTeacher()

  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generateAccessCode(name)
    const { data, error } = await supabase
      .from('subjects')
      .insert({
        name,
        semester: semester || null,
        credits,
        accent,
        icon,
        access_code: code,
        teacher_id: user.id,
        user_id: user.id,
      })
      .select('id, access_code')
      .single()
    if (!error && data) {
      revalidatePath('/teacher')
      revalidatePath('/teacher/courses')
      return { ok: true, id: data.id as string, access_code: data.access_code as string }
    }
    if (error && error.code === '23505') continue
    if (error) return { ok: false, error: error.message }
  }
  return { ok: false, error: 'No pudimos generar un código único. Intenta de nuevo.' }
}

export async function updateCourseAction(courseId: string, _prev: CourseFormState | undefined, formData: FormData): Promise<CourseFormState> {
  const parsed = CourseSchema.safeParse({
    name:     formData.get('name'),
    semester: formData.get('semester') || '',
    credits:  formData.get('credits') || 0,
    accent:   formData.get('accent') || 'blue',
    icon:     formData.get('icon') || 'menu_book',
  })
  if (!parsed.success) {
    const fieldErrors: CourseFormState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof CourseSchema>
      fieldErrors[key] = issue.message
    }
    return { ok: false, error: 'Revisa los campos', fieldErrors }
  }
  const { name, semester, credits, accent, icon } = parsed.data

  const { supabase, user } = await requireTeacher()
  const { error } = await supabase
    .from('subjects')
    .update({ name, semester: semester || null, credits, accent, icon })
    .eq('id', courseId)
    .eq('teacher_id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher')
  revalidatePath('/teacher/courses')
  revalidatePath(`/teacher/courses/${courseId}`)
  return { ok: true, id: courseId }
}

export async function regenerateAccessCodeAction(courseId: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  const { supabase, user } = await requireTeacher()
  const { data: course } = await supabase.from('subjects').select('name').eq('id', courseId).eq('teacher_id', user.id).single()
  if (!course) return { ok: false, error: 'Curso no encontrado' }
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generateAccessCode((course as { name: string }).name)
    const { data, error } = await supabase
      .from('subjects')
      .update({ access_code: code })
      .eq('id', courseId)
      .eq('teacher_id', user.id)
      .select('access_code')
      .single()
    if (!error && data) {
      revalidatePath(`/teacher/courses/${courseId}`)
      revalidatePath('/teacher/courses')
      return { ok: true, code: (data as { access_code: string }).access_code }
    }
    if (error && error.code === '23505') continue
    if (error) return { ok: false, error: error.message }
  }
  return { ok: false, error: 'No pudimos generar un código único.' }
}

export async function deleteCourseAction(courseId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireTeacher()
  const { error } = await supabase.from('subjects').delete().eq('id', courseId).eq('teacher_id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher')
  revalidatePath('/teacher/courses')
  return { ok: true }
}
