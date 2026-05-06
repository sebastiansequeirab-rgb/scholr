import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

export default async function StudentsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: course } = await supabase
    .from('subjects')
    .select('id, name, color, icon')
    .eq('id', params.id)
    .eq('teacher_id', user.id)
    .single()

  if (!course) notFound()

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, joined_at, profiles(id, full_name, avatar_url)')
    .eq('subject_id', params.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  const students = (enrollments ?? []).map((e) => {
    const p = (e.profiles as unknown) as { id: string; full_name: string; avatar_url: string | null } | null
    return {
      id: p?.id ?? '',
      full_name: p?.full_name ?? 'Estudiante',
      avatar_url: p?.avatar_url ?? null,
      joined_at: e.joined_at as string,
    }
  })

  return (
    <div className="max-w-2xl mx-auto reveal-stagger">
      <Link href={`/teacher/courses/${params.id}`} className="kicker inline-flex items-center gap-1.5 mb-3 hover:opacity-70 transition-opacity">
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        {course.name as string}
      </Link>

      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Curso · {students.length} {students.length === 1 ? 'estudiante' : 'estudiantes'}</span>
          <h1 className="screen-head__title">
            <span className="serif">estudiantes</span> inscritos
          </h1>
          <p className="screen-head__sub">
            Quienes accedieron al curso con el código compartido.
          </p>
        </div>
      </header>

      {students.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="material-symbols-outlined text-4xl mb-2 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            group
          </span>
          <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>Sin estudiantes aún</p>
          <p className="text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>
            Comparte el código de acceso para que se inscriban.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          {students.map((student, i) => (
            <div key={student.id || i} className="row" style={{ ['--accent-color' as string]: 'var(--color-primary)' }}>
              <div className="row__time flex items-center justify-center">
                <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                    color: 'var(--color-primary)',
                  }}>
                  {student.avatar_url
                    ? <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                    : getInitials(student.full_name)
                  }
                </div>
              </div>
              <div className="row__main">
                <div className="row__title">{student.full_name}</div>
                <div className="row__meta">
                  <span className="material-symbols-outlined mi">event_available</span>
                  Inscrito {new Date(student.joined_at).toLocaleDateString()}
                </div>
              </div>
              <div className="row__right text-[10px]" style={{ color: 'var(--color-outline)' }}>
                #{String(i + 1).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
