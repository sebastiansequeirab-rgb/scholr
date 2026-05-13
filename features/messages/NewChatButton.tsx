'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { accentClass } from '@/lib/accent'
import type { CourseAccent } from '@/types'

type Variant = 'teacher' | 'student'

interface Peer {
  id: string
  name: string
  avatarUrl: string | null
  courseId: string
  courseName: string
  courseAccent: CourseAccent | null
}

interface Props {
  variant: Variant
  currentUserId: string
}

export function NewChatButton({ variant, currentUserId }: Props) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [peers, setPeers] = useState<Peer[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchPeers = async () => {
      setLoading(true)
      const supabase = createClient()
      const collected: Peer[] = []
      if (variant === 'teacher') {
        // Get courses owned by teacher → enrolled students
        const { data: courses } = await supabase
          .from('subjects')
          .select('id, name, accent')
          .eq('teacher_id', currentUserId)

        for (const c of (courses ?? []) as { id: string; name: string; accent: string | null }[]) {
          const { data: enrolls } = await supabase
            .from('enrollments')
            .select('student_id, profiles:student_id(id, full_name, avatar_url)')
            .eq('subject_id', c.id)
            .eq('status', 'active')
          for (const e of (enrolls ?? []) as unknown as { student_id: string; profiles: { id: string; full_name: string | null; avatar_url: string | null } | null }[]) {
            if (!e.profiles) continue
            collected.push({
              id: e.profiles.id,
              name: e.profiles.full_name ?? 'Estudiante',
              avatarUrl: e.profiles.avatar_url,
              courseId: c.id,
              courseName: c.name,
              courseAccent: (c.accent ?? null) as CourseAccent | null,
            })
          }
        }
      } else {
        // Student: enrolled subjects → teachers
        const { data: enrolls } = await supabase
          .from('enrollments')
          .select(`subject_id,
            subjects:subject_id(
              id, name, accent, teacher_id,
              profiles!subjects_teacher_id_fkey(id, full_name, avatar_url)
            )`)
          .eq('student_id', currentUserId)
          .eq('status', 'active')
        for (const e of (enrolls ?? []) as unknown as { subject_id: string; subjects: { id: string; name: string; accent: string | null; teacher_id: string | null; profiles: { id: string; full_name: string | null; avatar_url: string | null } | null } | null }[]) {
          if (!e.subjects || !e.subjects.profiles || !e.subjects.teacher_id) continue
          collected.push({
            id: e.subjects.profiles.id,
            name: e.subjects.profiles.full_name ?? 'Profesor',
            avatarUrl: e.subjects.profiles.avatar_url,
            courseId: e.subjects.id,
            courseName: e.subjects.name,
            courseAccent: (e.subjects.accent ?? null) as CourseAccent | null,
          })
        }
      }
      if (!cancelled) {
        setPeers(collected)
        setLoading(false)
      }
    }
    fetchPeers()
    return () => { cancelled = true }
  }, [open, variant, currentUserId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return peers
    return peers.filter(p => p.name.toLowerCase().includes(q) || p.courseName.toLowerCase().includes(q))
  }, [peers, query])

  const baseRoute = variant === 'teacher' ? '/teacher/mensajes' : '/mensajes'

  const onSelect = (peer: Peer) => {
    setOpen(false)
    setQuery('')
    router.push(`${baseRoute}?with=${peer.id}&course=${peer.courseId}`)
  }

  return (
    <>
      <button
        type="button"
        className="t-btn-new chat-new-btn"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined">edit_square</span>
        {language === 'es' ? 'Nuevo chat' : 'New chat'}
      </button>

      {open && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="modal-content chat-new-modal" role="dialog" aria-modal="true">
            <header className="chat-new-modal__head">
              <h2 className="chat-new-modal__title">
                {language === 'es' ? 'Iniciar conversación' : 'Start a conversation'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="chat-new-modal__close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <input
              type="search"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={language === 'es' ? 'Buscar por nombre o curso…' : 'Search by name or course…'}
              className="chat-new-modal__search"
            />

            <div className="chat-new-modal__list">
              {loading && <div className="chat-new-modal__empty">{language === 'es' ? 'Cargando…' : 'Loading…'}</div>}
              {!loading && filtered.length === 0 && (
                <div className="chat-new-modal__empty">
                  <span className="material-symbols-outlined">person_search</span>
                  <span>
                    {variant === 'teacher'
                      ? (language === 'es' ? 'Sin estudiantes inscritos en tus cursos.' : 'No students enrolled in your courses.')
                      : (language === 'es' ? 'Inscribite a un curso para iniciar conversaciones.' : 'Enroll in a course to start conversations.')}
                  </span>
                </div>
              )}
              {!loading && filtered.map(p => (
                <button
                  key={`${p.id}-${p.courseId}`}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="chat-new-peer"
                >
                  <div className="chat-new-peer__avatar">
                    {p.avatarUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.avatarUrl} alt="" />
                      : <span>{getInitials(p.name)}</span>}
                  </div>
                  <div className="chat-new-peer__body">
                    <span className="chat-new-peer__name">{p.name}</span>
                    <span className={`chat-new-peer__course ${accentClass(p.courseAccent)}`}>{p.courseName}</span>
                  </div>
                  <span className="material-symbols-outlined chat-new-peer__chev">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default NewChatButton
