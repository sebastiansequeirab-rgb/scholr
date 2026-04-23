import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      day_of_week: number; start_time: string; end_time: string; room?: string | null
    }

    if (!start_time || !end_time || start_time >= end_time) {
      return NextResponse.json({ error: 'Horario inválido.' }, { status: 400 })
    }

    // Verify teacher owns this course
    const { data: course } = await supabase
      .from('subjects').select('id').eq('id', courseId).eq('teacher_id', user.id).single()
    if (!course) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 })

    // Insert teacher's own schedule
    const { data: schedule, error: schedError } = await supabase
      .from('schedules')
      .insert({ user_id: user.id, subject_id: courseId, day_of_week, start_time, end_time, room: room || null })
      .select().single()

    if (schedError || !schedule) {
      return NextResponse.json({ error: schedError?.message ?? 'Error al guardar.' }, { status: 500 })
    }

    // Propagate to enrolled students via SECURITY DEFINER function (no admin client needed)
    await supabase.rpc('propagate_schedule_to_students', {
      p_subject_id: courseId,
      p_day_of_week: day_of_week,
      p_start_time: start_time,
      p_end_time: end_time,
      p_room: room || null,
    })

    return NextResponse.json({ schedule })
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}

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

    // Fetch before deleting (need fields to remove student copies)
    const { data: schedule } = await supabase
      .from('schedules').select('day_of_week, start_time, end_time')
      .eq('id', scheduleId).eq('user_id', user.id).single()
    if (!schedule) return NextResponse.json({ error: 'Horario no encontrado.' }, { status: 404 })

    await supabase.from('schedules').delete().eq('id', scheduleId).eq('user_id', user.id)

    // Remove from enrolled students via SECURITY DEFINER function
    await supabase.rpc('remove_schedule_from_students', {
      p_subject_id: courseId,
      p_day_of_week: schedule.day_of_week,
      p_start_time: schedule.start_time,
      p_end_time: schedule.end_time,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
