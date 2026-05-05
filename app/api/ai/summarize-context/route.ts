import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { subject_id?: string; access_token?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { subject_id, access_token } = body
  if (!subject_id)   return NextResponse.json({ error: 'subject_id required' },  { status: 400 })
  if (!access_token) return NextResponse.json({ error: 'access_token required' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${access_token}` } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Fetch subject name, recent notes, all subject exams (parallel)
  // Notes stay user-scoped (private). Exams/upcoming rely on RLS — covers own
  // exams + enrolled teacher exams. Teacher-exam grades come from exam_grades.
  const [subjectRes, notesRes, upcomingRes, allExamsRes] = await Promise.all([
    supabase.from('subjects').select('name').eq('id', subject_id).single(),
    supabase.from('notes')
      .select('title, content')
      .eq('subject_id', subject_id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase.from('exams')
      .select('title, exam_date, percentage')
      .eq('subject_id', subject_id)
      .neq('activity_type', 'study_session')
      .gte('exam_date', new Date().toISOString().slice(0, 10))
      .order('exam_date', { ascending: true })
      .limit(3),
    supabase.from('exams')
      .select('id, grade, percentage, submission_status, assigned_by')
      .eq('subject_id', subject_id)
      .neq('activity_type', 'study_session'),
  ])

  // Overlay teacher-exam grades from exam_grades for this student
  const allExams = allExamsRes.data ?? []
  const teacherExamIds = allExams.filter(e => e.assigned_by != null).map(e => e.id as string)
  const teacherGradeMap: Record<string, number | null> = {}
  if (teacherExamIds.length > 0) {
    const { data: grades } = await supabase
      .from('exam_grades')
      .select('exam_id, grade')
      .eq('student_id', user.id)
      .in('exam_id', teacherExamIds)
    for (const g of (grades ?? []) as { exam_id: string; grade: number | null }[]) {
      teacherGradeMap[g.exam_id] = g.grade
    }
  }

  const subjectName = subjectRes.data?.name ?? 'la materia'

  // ── Build summary string ──────────────────────────────────────────────────

  const lines: string[] = [`Contexto académico — ${subjectName}`]

  // Recent notes
  const notes = notesRes.data ?? []
  if (notes.length > 0) {
    lines.push('\nNotas recientes:')
    notes.forEach((n, i) => {
      const plainText = (n.content ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
      const title = n.title && n.title.trim() ? n.title : 'Sin título'
      lines.push(`${i + 1}. "${title}" — ${plainText}${plainText.length === 200 ? '…' : ''}`)
    })
  }

  // Upcoming exams
  const upcoming = upcomingRes.data ?? []
  if (upcoming.length > 0) {
    lines.push('\nPróximas evaluaciones:')
    upcoming.forEach((e, i) => {
      const pct = e.percentage != null ? ` — ${e.percentage}%` : ''
      lines.push(`${i + 1}. ${e.title} — ${e.exam_date}${pct}`)
    })
  }

  // Progress — use exam_grades for teacher-assigned exams, exams.grade otherwise
  const progress = allExams.reduce((acc, e) => {
    const grade = e.assigned_by != null
      ? teacherGradeMap[e.id as string] ?? null
      : (e.submission_status === 'graded' ? e.grade : null)
    if (grade == null || e.percentage == null) return acc
    return acc + (grade * (e.percentage / 100))
  }, 0)
  lines.push(`\nProgreso actual: ${progress.toFixed(1)} / 20.0`)

  const summary = lines.join('\n')

  // ── Upsert into subject_ai_contexts ──────────────────────────────────────
  const { error: upsertError } = await supabase.from('subject_ai_contexts').upsert({
    user_id:         user.id,
    subject_id,
    summary,
    last_updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,subject_id' })

  if (upsertError) {
    console.error('[summarize-context] upsert error', upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ summary })
}
