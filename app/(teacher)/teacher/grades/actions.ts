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

async function assertTeacherOwnsExam(supabase: ReturnType<typeof createClient>, examId: string, userId: string) {
  const { data } = await supabase
    .from('exams')
    .select('id, subject_id, subjects:subject_id(teacher_id)')
    .eq('id', examId)
    .single()
  // RLS already enforces but verify explicitly
  const subj = (data as unknown as { subjects: { teacher_id: string } | null } | null)?.subjects
  if (!data || !subj || subj.teacher_id !== userId) {
    throw new Error('No tienes permiso para editar esta calificación')
  }
  return data as unknown as { id: string; subject_id: string }
}

const GradeSchema = z.object({
  examId:    z.string().uuid(),
  studentId: z.string().uuid(),
  grade:     z.number().min(0).max(20).nullable(),
})

export async function updateGradeAction(input: { examId: string; studentId: string; grade: number | null }) {
  const parsed = GradeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireTeacher()

  try {
    const exam = await assertTeacherOwnsExam(supabase, parsed.data.examId, user.id)

    if (parsed.data.grade == null) {
      const { error } = await supabase
        .from('exam_grades')
        .delete()
        .eq('exam_id', parsed.data.examId)
        .eq('student_id', parsed.data.studentId)
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await supabase
        .from('exam_grades')
        .upsert({
          exam_id:    parsed.data.examId,
          student_id: parsed.data.studentId,
          grade:      parsed.data.grade,
          graded_at:  new Date().toISOString(),
        }, { onConflict: 'exam_id,student_id' })
      if (error) return { ok: false, error: error.message }
    }
    revalidatePath('/teacher/grades')
    revalidatePath(`/teacher/courses/${exam.subject_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error' }
  }
}

const ExamSchema = z.object({
  courseId:   z.string().uuid(),
  title:      z.string().trim().min(1).max(120),
  percentage: z.coerce.number().min(0).max(100),
  examDate:   z.string().trim().min(10).max(10),
  position:   z.coerce.number().int().optional().default(0),
})

export async function createExamAction(input: { courseId: string; title: string; percentage: number; examDate: string; position?: number }) {
  const parsed = ExamSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireTeacher()

  // Make sure teacher owns the subject
  const { data: subj } = await supabase.from('subjects').select('id, teacher_id').eq('id', parsed.data.courseId).single()
  if (!subj || (subj as { teacher_id: string }).teacher_id !== user.id) {
    return { ok: false, error: 'No tienes permiso para este curso' }
  }

  const { data, error } = await supabase
    .from('exams')
    .insert({
      subject_id:   parsed.data.courseId,
      user_id:      user.id,
      assigned_by:  user.id,
      title:        parsed.data.title,
      percentage:   parsed.data.percentage,
      exam_date:    parsed.data.examDate,
      max_grade:    20,
      activity_type: 'exam',
      position:     parsed.data.position ?? 0,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/grades')
  revalidatePath(`/teacher/courses/${parsed.data.courseId}`)
  return { ok: true, id: (data as { id: string }).id }
}

export async function deleteExamAction(examId: string) {
  const { supabase, user } = await requireTeacher()
  try {
    const exam = await assertTeacherOwnsExam(supabase, examId, user.id)
    const { error } = await supabase.from('exams').delete().eq('id', examId)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/teacher/grades')
    revalidatePath(`/teacher/courses/${exam.subject_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error' }
  }
}

/** Build a CSV string for the given course(s). Returns { ok, csv?, filename?, error? } */
export async function exportGradesCsvAction(courseId: string | null): Promise<{ ok: boolean; csv?: string; filename?: string; error?: string }> {
  const { supabase, user } = await requireTeacher()

  const coursesQuery = supabase
    .from('subjects')
    .select('id, name, semester, exams(id, title, percentage, position, exam_date, exam_grades(grade, student_id)), enrollments(student_id, status, profiles(id, full_name))')
    .eq('teacher_id', user.id)

  if (courseId) coursesQuery.eq('id', courseId)

  const { data, error } = await coursesQuery
  if (error) return { ok: false, error: error.message }

  type Row = {
    id: string
    name: string
    semester: string | null
    exams: { id: string; title: string; percentage: number | null; position: number | null; exam_date: string | null; exam_grades: { grade: number | null; student_id: string }[] }[]
    enrollments: { student_id: string; status: string; profiles: { id: string; full_name: string } | null }[]
  }

  const courses = (data ?? []) as unknown as Row[]
  const escape = (s: unknown) => {
    const v = s == null ? '' : String(s)
    if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }

  const chunks: string[] = []
  for (const c of courses) {
    const exams = [...c.exams].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.exam_date ?? '').localeCompare(b.exam_date ?? ''))
    const students = c.enrollments.filter(e => e.status === 'active' && e.profiles).map(e => e.profiles!)
    students.sort((a, b) => a.full_name.localeCompare(b.full_name))

    chunks.push(`# ${c.name}${c.semester ? ` — ${c.semester}` : ''}`)
    const header = ['Estudiante', ...exams.map(e => `${e.title} (${e.percentage ?? 0}%)`), 'Promedio']
    chunks.push(header.map(escape).join(','))

    for (const s of students) {
      const cells: (string | number)[] = [s.full_name]
      let earned = 0
      let gradedWeight = 0
      for (const ex of exams) {
        const g = ex.exam_grades.find(x => x.student_id === s.id)?.grade
        cells.push(g == null ? '' : g.toFixed(2))
        if (g != null && (ex.percentage ?? 0) > 0) {
          earned += g * ((ex.percentage ?? 0) / 100)
          gradedWeight += (ex.percentage ?? 0)
        }
      }
      const avg = gradedWeight === 0 ? null : earned / (gradedWeight / 100)
      cells.push(avg == null ? '' : avg.toFixed(2))
      chunks.push(cells.map(escape).join(','))
    }
    chunks.push('') // blank line between courses
  }

  const csv = '﻿' + chunks.join('\n') // BOM for Excel UTF-8
  const today = new Date().toISOString().slice(0, 10)
  const filename = courseId
    ? `skolar-grades-${courses[0]?.name?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() ?? 'course'}-${today}.csv`
    : `skolar-grades-${today}.csv`
  return { ok: true, csv, filename }
}
