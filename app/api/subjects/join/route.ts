import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { code?: string }
    const code = body.code?.trim()

    if (!code) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 })
    }

    // RLS policy "Authenticated users can read teacher courses" allows this lookup
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('id, name, color, icon, teacher_id')
      .eq('access_code', code.toUpperCase())
      .single()

    if (subjectError || !subject) {
      return NextResponse.json({ error: 'Código no válido. Verifica e intenta de nuevo.' }, { status: 404 })
    }

    // Can't enroll in your own course
    if (subject.teacher_id === user.id) {
      return NextResponse.json({ error: 'No puedes inscribirte en tu propio curso.' }, { status: 400 })
    }

    // Create enrollment — RLS allows INSERT where student_id = auth.uid()
    const { error: enrollError } = await supabase
      .from('enrollments')
      .insert({ student_id: user.id, subject_id: subject.id })

    if (enrollError) {
      if (enrollError.code === '23505') {
        return NextResponse.json({ error: 'Ya estás inscrito en este curso.' }, { status: 409 })
      }
      return NextResponse.json({ error: enrollError.message }, { status: 500 })
    }

    // Copy teacher's existing schedules to this student (best-effort, non-blocking)
    if (process.env.SUPABASE_SECRET_KEY) {
      try {
        const adminClient = createAdminClient()

        const { data: teacherSchedules } = await adminClient
          .from('schedules')
          .select('day_of_week, start_time, end_time, room')
          .eq('subject_id', subject.id)
          .eq('user_id', subject.teacher_id)

        if (teacherSchedules && teacherSchedules.length > 0) {
          await supabase.from('schedules').insert(
            teacherSchedules.map((s) => ({
              user_id: user.id,
              subject_id: subject.id,
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              room: s.room,
            }))
          )
        }
      } catch {
        // Non-blocking — student is enrolled, schedules can sync later
      }
    }

    return NextResponse.json({ subject })
  } catch {
    return NextResponse.json({ error: 'Error interno. Intenta de nuevo.' }, { status: 500 })
  }
}
