import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubmissionInline, type SubmissionState } from '@/features/home/components/SubmissionInline'
import { DashboardRefresher } from '@/features/home/components/DashboardRefresher'
import { accentClass, gradeClass } from '@/lib/accent'

export const dynamic = 'force-dynamic'

export default async function StudentSubmissionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Enrolled course ids
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('subject_id, subjects(id, name, accent, icon)')
    .eq('student_id', user.id)
    .eq('status', 'active')

  type Enrollment = { subject_id: string; subjects: { id: string; name: string; accent: string | null; icon: string | null } | null }
  const enrolled = ((enrollments ?? []) as unknown as Enrollment[]).filter(e => e.subjects)

  const courseIds = enrolled.map(e => e.subject_id)
  const courseById = new Map(enrolled.map(e => [e.subject_id, e.subjects!]))

  let exams: { id: string; subject_id: string; title: string; exam_date: string; percentage: number | null; assigned_by: string | null }[] = []
  let mySubmissions: { exam_id: string | null; status: string; submitted_at: string }[] = []
  let myGrades: { exam_id: string; grade: number | null }[] = []

  if (courseIds.length > 0) {
    const [
      { data: examsData },
      { data: subsData },
      { data: gradesData },
    ] = await Promise.all([
      supabase.from('exams')
        .select('id, subject_id, title, exam_date, percentage, assigned_by')
        .in('subject_id', courseIds)
        .not('assigned_by', 'is', null)
        .order('exam_date', { ascending: true }),
      supabase.from('submissions')
        .select('exam_id, status, submitted_at')
        .eq('student_id', user.id),
      supabase.from('exam_grades')
        .select('exam_id, grade')
        .eq('student_id', user.id),
    ])
    exams = (examsData ?? []) as never
    mySubmissions = (subsData ?? []) as never
    myGrades = (gradesData ?? []) as never
  }

  const subByExam: Record<string, SubmissionState> = {}
  for (const s of mySubmissions) {
    if (!s.exam_id) continue
    subByExam[s.exam_id] = { exists: true, status: s.status as SubmissionState['status'], submitted_at: s.submitted_at }
  }
  const gradeByExam: Record<string, number | null> = {}
  for (const g of myGrades) gradeByExam[g.exam_id] = g.grade

  return (
    <div className="t-screen">
      <DashboardRefresher />
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">Estudiante</span>
          <h1 className="t-section-head__title">entregas</h1>
        </div>
        <Link href="/dashboard" className="t-section-head__link">
          <span className="material-symbols-outlined">arrow_back</span>
          Dashboard
        </Link>
      </header>

      {exams.length === 0 ? (
        <div className="t-empty" style={{ marginTop: 22 }}>
          <div className="t-empty__icon"><span className="material-symbols-outlined">assignment</span></div>
          <div className="t-empty__title">Sin entregas pendientes</div>
          <div className="t-empty__sub">
            Cuando tus profesores creen exámenes o actividades en sus cursos, aparecerán aquí para que puedas entregar tu trabajo.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          {exams.map((ex) => {
            const course = courseById.get(ex.subject_id)
            const sub = subByExam[ex.id] ?? { exists: false, status: null, submitted_at: null }
            const grade = gradeByExam[ex.id] ?? null
            return (
              <article key={ex.id} className={`t-card t-card--accent ${accentClass(course?.accent ?? null)}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--accent-color, var(--color-primary))' }}>{course?.icon || 'menu_book'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="t-tag">{course?.name ?? '—'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-outline)' }}>
                        {new Date(ex.exam_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      {ex.percentage != null && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-color, var(--color-primary))' }}>
                          {ex.percentage}%
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 19, color: 'var(--on-surface)', marginTop: 4 }}>{ex.title}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {grade != null && (
                      <span className={`${gradeClass(grade)}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600 }}>{grade.toFixed(1)}</span>
                    )}
                    <SubmissionInline examId={ex.id} examTitle={ex.title} initial={sub} />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
