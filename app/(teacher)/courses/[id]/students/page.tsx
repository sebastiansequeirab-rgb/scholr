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
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/teacher/courses/${params.id}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-outline)' }}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {course.name as string}
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
          Estudiantes inscritos
        </h1>
        <span className="text-sm font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>
          {students.length}
        </span>
      </div>

      {students.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            group
          </span>
          <p className="font-semibold" style={{ color: 'var(--on-surface)' }}>Sin estudiantes aún</p>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>
            Comparte el código de acceso para que se inscriban.
          </p>
        </div>
      ) : (
        <div className="card divide-y">
          {students.map((student, i) => (
            <div key={student.id || i} className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[11px] font-bold"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                  color: 'var(--color-primary)',
                }}>
                {student.avatar_url
                  ? <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                  : getInitials(student.full_name)
                }
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--on-surface)' }}>
                  {student.full_name}
                </p>
                <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
                  Inscrito {new Date(student.joined_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
