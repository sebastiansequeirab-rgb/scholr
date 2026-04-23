import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── POST — add schedule + propagate to enrolled students ──────────────────────
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = params.id
    const { day_of_week, start_time, end_time, room } = await request.json() as {
      day_of_week: number
      start_time: string
      end_time: string
      room?: string | null
    }

    if (!start_time || !end_time || start_time >= end_time) {
      return NextResponse.json({ error: 'Horario inválido.' }, { status: 400 })
    }

    // Verify teacher owns this course
    const { data: course } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', courseId)
      .eq('teacher_id', user.id)
      .single()

    if (!course) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 })

    // Insert teacher's own schedule
    const { data: schedule, error: schedError } = await supabase
      .from('schedules')
      .insert({
        user_id: user.id,
        subject_id: courseId,
        day_of_week,
        start_time,
        end_time,
        room: room || null,
      })
      .select()
      .single()

    if (schedError || !schedule) {
      return NextResponse.json({ error: schedError?.message ?? 'Error al guardar.' }, { status: 500 })
    }

    // Propagate to all enrolled students (best-effort)
    if (process.env.SUPABASE_SECRET_KEY) {
      try {
        const adminClient = createAdminClient()

        // Teacher has RLS access to see their course enrollments
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('subject_id', courseId)
          .eq('status', 'active')

        if (enrollments && enrollments.length > 0) {
          await adminClient.from('schedules').insert(
            enrollments.map((e) => ({
              user_id: e.student_id,
              subject_id: courseId,
              day_of_week,
              start_time,
              end_time,
              room: room || null,
            }))
          )
        }
      } catch {
        // Non-blocking — schedule saved for teacher, propagation failed
      }
    }

    return NextResponse.json({ schedule })
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}

// ── DELETE — remove schedule + remove from enrolled students ──────────────────
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = params.id
    const { scheduleId } = await request.json() as { scheduleId: string }

    // Fetch schedule details before deleting (needed to match student copies)
    const { data: schedule } = await supabase
      .from('schedules')
      .select('day_of_week, start_time, end_time')
      .eq('id', scheduleId)
      .eq('user_id', user.id)
      .single()

    if (!schedule) return NextResponse.json({ error: 'Horario no encontrado.' }, { status: 404 })

    // Delete teacher's schedule
    await supabase.from('schedules').delete().eq('id', scheduleId).eq('user_id', user.id)

    // Remove student copies (best-effort)
    if (process.env.SUPABASE_SECRET_KEY) {
      try {
        const adminClient = createAdminClient()

        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('subject_id', courseId)
          .eq('status', 'active')

        if (enrollments && enrollments.length > 0) {
          const studentIds = enrollments.map((e) => e.student_id as string)
          await adminClient
            .from('schedules')
            .delete()
            .eq('subject_id', courseId)
            .eq('day_of_week', schedule.day_of_week)
            .eq('start_time', schedule.start_time)
            .eq('end_time', schedule.end_time)
            .in('user_id', studentIds)
        }
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
