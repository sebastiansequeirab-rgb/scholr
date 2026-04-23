import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { code?: string }
    const code = body.code?.trim()
    if (!code) return NextResponse.json({ error: 'Access code is required' }, { status: 400 })

    // RLS policy "Authenticated users can read teacher courses" allows this
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('id, name, color, icon, teacher_id')
      .eq('access_code', code.toUpperCase())
      .single()

    if (subjectError || !subject) {
      return NextResponse.json({ error: 'Código no válido. Verifica e intenta de nuevo.' }, { status: 404 })
    }

    if (subject.teacher_id === user.id) {
      return NextResponse.json({ error: 'No puedes inscribirte en tu propio curso.' }, { status: 400 })
    }

    const { error: enrollError } = await supabase
      .from('enrollments')
      .insert({ student_id: user.id, subject_id: subject.id })

    if (enrollError) {
      if (enrollError.code === '23505') {
        return NextResponse.json({ error: 'Ya estás inscrito en este curso.' }, { status: 409 })
      }
      return NextResponse.json({ error: enrollError.message }, { status: 500 })
    }

    // Copy existing teacher schedules to the new student via SECURITY DEFINER function
    await supabase.rpc('copy_teacher_schedules_to_student', {
      p_subject_id: subject.id,
      p_student_id: user.id,
    })

    return NextResponse.json({ subject })
  } catch {
    return NextResponse.json({ error: 'Error interno. Intenta de nuevo.' }, { status: 500 })
  }
}
