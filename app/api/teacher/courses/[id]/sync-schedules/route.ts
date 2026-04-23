import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = params.id

    const { data: course } = await supabase
      .from('subjects').select('id').eq('id', courseId).eq('teacher_id', user.id).single()
    if (!course) return NextResponse.json({ error: 'Curso no encontrado.' }, { status: 404 })

    // SECURITY DEFINER function handles the full backfill, no admin client needed
    const { data: synced, error } = await supabase.rpc('sync_course_schedules_to_all_students', {
      p_subject_id: courseId,
      p_teacher_id: user.id,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ synced: synced ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
