'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

async function requireTeacher() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'teacher') redirect('/dashboard')
  return { supabase, user }
}

export async function uploadDocumentAction(formData: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const courseId = String(formData.get('courseId') || '')
  const file = formData.get('file') as File | null
  if (!courseId) return { ok: false, error: 'Curso requerido' }
  if (!file || file.size === 0) return { ok: false, error: 'Archivo vacío' }
  if (file.size > MAX_BYTES) return { ok: false, error: `Máximo ${Math.round(MAX_BYTES / 1024 / 1024)} MB` }

  const { supabase, user } = await requireTeacher()

  const { data: subj } = await supabase.from('subjects').select('id, teacher_id').eq('id', courseId).single()
  if (!subj || (subj as { teacher_id: string }).teacher_id !== user.id) {
    return { ok: false, error: 'No tienes permiso para este curso' }
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
  const uuid = crypto.randomUUID()
  const path = `${courseId}/${uuid}-${cleanName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('course-documents')
    .upload(path, arrayBuffer, { contentType: file.type || `application/octet-stream`, upsert: false })
  if (uploadError) return { ok: false, error: uploadError.message }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      subject_id:   courseId,
      uploaded_by:  user.id,
      title:        cleanName,
      file_url:     path,           // store STORAGE PATH, not public URL
      file_type:    file.type || `application/octet-stream`,
      size_bytes:   file.size,
    })
    .select('id')
    .single()
  if (error) {
    // best-effort cleanup
    await supabase.storage.from('course-documents').remove([path])
    return { ok: false, error: error.message }
  }

  revalidatePath('/teacher/documents')
  revalidatePath(`/teacher/courses/${courseId}`)
  return { ok: true, id: (data as { id: string }).id }
}

const RenameSchema = z.object({ documentId: z.string().uuid(), title: z.string().trim().min(1).max(160) })

export async function renameDocumentAction(input: { documentId: string; title: string }) {
  const parsed = RenameSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' }
  const { supabase, user } = await requireTeacher()
  // RLS scopes; also re-check via subjects.teacher_id
  const { data: doc } = await supabase.from('documents').select('id, subject_id, subjects:subject_id(teacher_id)').eq('id', parsed.data.documentId).single()
  const subj = (doc as unknown as { subjects: { teacher_id: string } | null } | null)?.subjects
  if (!doc || !subj || subj.teacher_id !== user.id) return { ok: false, error: 'No tienes permiso' }
  const { error } = await supabase.from('documents').update({ title: parsed.data.title }).eq('id', parsed.data.documentId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/documents')
  return { ok: true }
}

export async function deleteDocumentAction(documentId: string) {
  const { supabase, user } = await requireTeacher()
  const { data: doc } = await supabase.from('documents').select('id, file_url, subject_id, subjects:subject_id(teacher_id)').eq('id', documentId).single()
  const subj = (doc as unknown as { subjects: { teacher_id: string } | null } | null)?.subjects
  if (!doc || !subj || subj.teacher_id !== user.id) return { ok: false, error: 'No tienes permiso' }
  const path = (doc as { file_url: string | null }).file_url
  if (path) await supabase.storage.from('course-documents').remove([path])
  const { error } = await supabase.from('documents').delete().eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/documents')
  return { ok: true }
}

export async function getDocumentSignedUrlAction(documentId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }
  const { data: doc } = await supabase.from('documents').select('id, file_url, subject_id').eq('id', documentId).single()
  if (!doc) return { ok: false, error: 'Documento no encontrado' }
  const path = (doc as { file_url: string | null }).file_url
  if (!path) return { ok: false, error: 'Sin archivo' }
  const { data, error } = await supabase.storage.from('course-documents').createSignedUrl(path, 60 * 60)
  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo firmar la URL' }
  return { ok: true, url: data.signedUrl }
}
