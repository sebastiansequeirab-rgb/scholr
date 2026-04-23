import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await request.json() as { code: string }

  if (!code?.trim()) {
    return NextResponse.json({ error: 'Access code is required' }, { status: 400 })
  }

  // Find subject by access_code
  const { data: subject, error: subjectError } = await supabase
    .from('subjects')
    .select('id, name, color, icon, teacher_id')
    .eq('access_code', code.trim().toUpperCase())
    .single()

  if (subjectError || !subject) {
    return NextResponse.json({ error: 'Código no válido. Verifica e intenta de nuevo.' }, { status: 404 })
  }

  // Can't enroll in your own subject (if you're the teacher)
  if (subject.teacher_id === user.id) {
    return NextResponse.json({ error: 'No puedes inscribirte en tu propio curso.' }, { status: 400 })
  }

  // Create enrollment (UNIQUE constraint prevents duplicates)
  const { error: enrollError } = await supabase
    .from('enrollments')
    .insert({ student_id: user.id, subject_id: subject.id })

  if (enrollError) {
    if (enrollError.code === '23505') {
      return NextResponse.json({ error: 'Ya estás inscrito en este curso.' }, { status: 409 })
    }
    return NextResponse.json({ error: enrollError.message }, { status: 500 })
  }

  return NextResponse.json({ subject })
}
