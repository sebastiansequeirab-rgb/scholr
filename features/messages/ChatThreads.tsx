'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { accentClass } from '@/lib/accent'
import { getInitials } from '@/lib/utils'
import { sendChatMessageAction, markThreadReadAction } from '@/app/(teacher)/teacher/mensajes/actions'
import { sendStudentReplyAction, markStudentThreadReadAction } from '@/app/(app)/mensajes/actions'
import type { CourseAccent } from '@/types'

export type ChatMessageRow = {
  id: string
  teacher_id: string
  student_id: string
  course_id: string | null
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
}

export type Thread = {
  threadKey: string
  peerId: string
  peerName: string
  peerAvatar: string | null
  courseId: string | null
  courseName: string | null
  courseAccent: CourseAccent | null
  lastBody: string
  lastAt: string
  unread: number
  messages: ChatMessageRow[]
}

type Variant = 'teacher' | 'student'

interface Props {
  variant: Variant
  currentUserId: string
  threads: Thread[]
}

function threadKey(peerId: string, courseId: string | null) {
  return `${peerId}:${courseId ?? '-'}`
}

function formatRelative(iso: string, lang: 'es' | 'en'): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return lang === 'es' ? 'ahora' : 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string, lang: 'es' | 'en'): string {
  return new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })
}

export function ChatThreads({ variant, currentUserId, threads }: Props) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [composer, setComposer] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const lang = language === 'es' ? 'es' : 'en'

  const initialPeer = searchParams.get('with')
  const initialCourse = searchParams.get('course')
  const initialKey = initialPeer
    ? threadKey(initialPeer, initialCourse && initialCourse !== '-' ? initialCourse : null)
    : threads[0]?.threadKey ?? null

  const [activeKey, setActiveKey] = useState<string | null>(initialKey)

  // Sync activeKey with URL when threads change
  useEffect(() => {
    if (!activeKey && threads.length > 0) setActiveKey(threads[0].threadKey)
  }, [threads, activeKey])

  const activeThread = useMemo(
    () => threads.find(t => t.threadKey === activeKey) ?? null,
    [threads, activeKey],
  )

  // Mark thread as read when opened
  useEffect(() => {
    if (!activeThread || activeThread.unread === 0) return
    if (variant === 'teacher' && activeThread.courseId) {
      startTransition(async () => {
        await markThreadReadAction({
          studentId: activeThread.peerId,
          courseId: activeThread.courseId!,
        })
        router.refresh()
      })
    } else if (variant === 'student') {
      startTransition(async () => {
        await markStudentThreadReadAction({
          teacherId: activeThread.peerId,
          courseId: activeThread.courseId,
        })
        router.refresh()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.threadKey])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeThread?.messages.length, activeThread?.threadKey])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${variant}-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [variant, currentUserId, router])

  const handleSend = useCallback(() => {
    if (!activeThread) return
    const body = composer.trim()
    if (!body) return

    startTransition(async () => {
      const result =
        variant === 'teacher'
          ? activeThread.courseId
            ? await sendChatMessageAction({
                studentId: activeThread.peerId,
                courseId: activeThread.courseId,
                body,
              })
            : { ok: false, error: 'No course' }
          : activeThread.courseId
          ? await sendStudentReplyAction({
              teacherId: activeThread.peerId,
              courseId: activeThread.courseId,
              body,
            })
          : { ok: false, error: 'No course' }

      if (result.ok) {
        setComposer('')
        router.refresh()
      } else {
        toast.error(result.error ?? t('teacher.messages.errorSending'))
      }
    })
  }, [activeThread, composer, router, t, variant])

  // If URL has ?with=&course= but no matching thread exists, show a virtual empty conversation
  // so the user can send the first message and create the thread.
  const virtualPeer = (() => {
    if (activeThread) return null
    const peerId = searchParams.get('with')
    const courseId = searchParams.get('course')
    if (!peerId || !courseId || courseId === '-') return null
    return { peerId, courseId }
  })()

  const handleSendFirst = useCallback(() => {
    if (!virtualPeer) return
    const body = composer.trim()
    if (!body) return
    startTransition(async () => {
      const result =
        variant === 'teacher'
          ? await sendChatMessageAction({ studentId: virtualPeer.peerId, courseId: virtualPeer.courseId, body })
          : await sendStudentReplyAction({ teacherId: virtualPeer.peerId, courseId: virtualPeer.courseId, body })
      if (result.ok) {
        setComposer('')
        router.refresh()
      } else {
        toast.error(result.error ?? t('teacher.messages.errorSending'))
      }
    })
  }, [virtualPeer, composer, variant, router, t])

  if (threads.length === 0 && !virtualPeer) {
    return (
      <div className="t-empty" style={{ marginTop: 22 }}>
        <div className="t-empty__icon">
          <span className="material-symbols-outlined">forum</span>
        </div>
        <div className="t-empty__title">{t('teacher.messages.empty')}</div>
        <div className="t-empty__sub">{t('teacher.messages.emptyDesc')}</div>
      </div>
    )
  }

  return (
    <div className="chat-shell">
      {/* Thread list */}
      <aside className="chat-shell__list" aria-label="Conversaciones">
        {threads.map(th => {
          const active = th.threadKey === activeKey
          const accent = accentClass(th.courseAccent)
          return (
            <button
              key={th.threadKey}
              type="button"
              onClick={() => setActiveKey(th.threadKey)}
              className={`chat-thread ${active ? 'is-active' : ''}`}
            >
              <div className="chat-thread__avatar" aria-hidden>
                {th.peerAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={th.peerAvatar} alt="" />
                ) : (
                  <span>{getInitials(th.peerName)}</span>
                )}
              </div>
              <div className="chat-thread__body">
                <div className="chat-thread__row">
                  <span className="chat-thread__name">{th.peerName}</span>
                  <span className="chat-thread__time">{formatRelative(th.lastAt, lang)}</span>
                </div>
                {th.courseName && (
                  <span className={`chat-thread__tag ${accent}`}>{th.courseName}</span>
                )}
                <div className="chat-thread__preview">{th.lastBody}</div>
              </div>
              {th.unread > 0 && (
                <span className="chat-thread__badge" aria-label={`${th.unread} ${t('teacher.messages.unread')}`}>
                  {th.unread}
                </span>
              )}
            </button>
          )
        })}
      </aside>

      {/* Active conversation */}
      <section className="chat-shell__conv" aria-label="Conversación activa">
        {activeThread ? (
          <>
            <header className="chat-conv__head">
              <div className="chat-conv__head-left">
                <div className="chat-conv__avatar">
                  {activeThread.peerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeThread.peerAvatar} alt="" />
                  ) : (
                    <span>{getInitials(activeThread.peerName)}</span>
                  )}
                </div>
                <div>
                  <div className="chat-conv__name">{activeThread.peerName}</div>
                  {activeThread.courseName && (
                    <span className={`chat-conv__tag ${accentClass(activeThread.courseAccent)}`}>
                      {activeThread.courseName}
                    </span>
                  )}
                </div>
              </div>
            </header>

            <div className="chat-conv__list" ref={listRef}>
              {activeThread.messages.map(m => {
                const own = m.sender_id === currentUserId
                return (
                  <div key={m.id} className={`chat-bubble-row ${own ? 'is-own' : ''}`}>
                    {!own && (
                      <div className="chat-bubble__avatar" aria-hidden>
                        {activeThread.peerAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={activeThread.peerAvatar} alt="" />
                        ) : (
                          <span>{getInitials(activeThread.peerName)}</span>
                        )}
                      </div>
                    )}
                    <div className={`chat-bubble ${own ? 'is-own' : ''}`}>
                      <div className="chat-bubble__body">{m.body}</div>
                      <div className="chat-bubble__time">{formatTime(m.created_at, lang)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <form
              className="chat-conv__composer"
              onSubmit={e => {
                e.preventDefault()
                handleSend()
              }}
            >
              <textarea
                value={composer}
                onChange={e => setComposer(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={t('teacher.messages.sendPlaceholder')}
                rows={2}
                disabled={pending || !activeThread.courseId}
              />
              <button
                type="submit"
                className="chat-conv__send"
                disabled={pending || !composer.trim() || !activeThread.courseId}
              >
                <span className="material-symbols-outlined">send</span>
                <span>{pending ? t('teacher.messages.sending') : t('teacher.messages.send')}</span>
              </button>
            </form>
          </>
        ) : virtualPeer ? (
          <>
            <header className="chat-conv__head">
              <div className="chat-conv__head-left">
                <div className="chat-conv__avatar">
                  <span>·</span>
                </div>
                <div>
                  <div className="chat-conv__name">{t('teacher.messages.newThread')}</div>
                </div>
              </div>
            </header>
            <div className="chat-conv__list" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-outline)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <span>{language === 'es' ? 'Sin mensajes aún — escribí el primero' : 'No messages yet — write the first one'}</span>
            </div>
            <form
              className="chat-conv__composer"
              onSubmit={e => { e.preventDefault(); handleSendFirst() }}
            >
              <textarea
                value={composer}
                onChange={e => setComposer(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendFirst() }
                }}
                placeholder={t('teacher.messages.sendPlaceholder')}
                rows={2}
                disabled={pending}
                autoFocus
              />
              <button type="submit" className="chat-conv__send" disabled={pending || !composer.trim()}>
                <span className="material-symbols-outlined">send</span>
                <span>{pending ? t('teacher.messages.sending') : t('teacher.messages.send')}</span>
              </button>
            </form>
          </>
        ) : (
          <div className="chat-empty">
            <div className="chat-empty__title">{t('teacher.messages.selectThread')}</div>
            <div className="chat-empty__sub">{t('teacher.messages.selectThreadDesc')}</div>
          </div>
        )}
      </section>
    </div>
  )
}
