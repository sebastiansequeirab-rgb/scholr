'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

const WeekSchema = z.object({
  current_week: z.coerce.number().int().min(1).max(60),
  semester_weeks: z.coerce.number().int().min(1).max(60),
}).refine(v => v.current_week <= v.semester_weeks, {
  message: 'La semana actual no puede ser mayor al total',
  path: ['current_week'],
})

export async function updateSemesterProgressAction(
  input: { current_week: number; semester_weeks: number },
): Promise<{ ok: boolean; error?: string }> {
  const parsed = WeekSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inválido' }
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('profiles')
    .update({
      current_week: parsed.data.current_week,
      semester_weeks: parsed.data.semester_weeks,
    })
    .eq('id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}
