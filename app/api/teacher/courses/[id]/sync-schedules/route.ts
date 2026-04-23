import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/teacher/courses/[id]/sync-schedules
 * Copies all teacher schedules for this course to every enrolled student.
 * Idempotent — skips students who already have the schedule.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = params.id

    // Verify teacher owns this course
    const { data: course } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', courseId)
      .eq('teacher_id', user.id)
      .single()

    if (!course) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 })

    // Fetch teacher's schedules for this course
    const { data: teacherSchedules } = await supabase
      .from('schedules')
      .select('day_of_week, start_time, end_time, room')
      .eq('subject_id', courseId)
      .eq('user_id', user.id)

    if (!teacherSchedules || teacherSchedules.length === 0) {
      return NextResponse.json({ synced: 0 })
    }

    // Fetch all active enrolled students
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('subject_id', courseId)
      .eq('status', 'active')

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ synced: 0 })
    }

    const adminClient = createAdminClient()
    let synced = 0

    for (const enrollment of enrollments) {
      const studentId = enrollment.student_id as string

      // Get student's existing schedules for this subject to avoid duplicates
      const { data: existing } = await adminClient
        .from('schedules')
        .select('day_of_week, start_time, end_time')
        .eq('subject_id', courseId)
        .eq('user_id', studentId)

      const existingKeys = new Set(
        (existing ?? []).map((s) => `${s.day_of_week}-${s.start_time}-${s.end_time}`)
      )

      const toInsert = teacherSchedules
        .filter((s) => !existingKeys.has(`${s.day_of_week}-${s.start_time}-${s.end_time}`))
        .map((s) => ({
          user_id: studentId,
          subject_id: courseId,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
        }))

      if (toInsert.length > 0) {
        await adminClient.from('schedules').insert(toInsert)
        synced += toInsert.length
      }
    }

    return NextResponse.json({ synced })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
