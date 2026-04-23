'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { debounce, timeAgo, uniqueById } from '@/lib/utils'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Node, mergeAttributes } from '@tiptap/core'
import type { Note, Subject } from '@/types'

// ── Custom inline image node ─────────────────────────────────────────
const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: {},
      alt: { default: null },
    }
  },
  parseHTML() { return [{ tag: 'img[src]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { class: 'max-w-full rounded-xl my-3' })]
  },
})

// ── Note editor ──────────────────────────────────────────────────────
function NoteEditor({
  note,
  subjects,
  onUpdated,
  onSubjectChanged,
  onBack,
}: {
  note: Note
  subjects: Subject[]
  onUpdated: (id: string, title: string, content: string) => void
  onSubjectChanged: (noteId: string, subjectId: string | null) => void
  onBack?: () => void
}) {
  const { t } = useTranslation()
  const [title,           setTitle]           = useState(note.title)
  const [saveStatus,      setSaveStatus]      = useState<'saved' | 'saving' | null>('saved')
  const [lastSaved,       setLastSaved]       = useState(note.updated_at)
  const [subjectDropdown, setSubjectDropdown] = useState(false)
  const [uploadingImage,  setUploadingImage]  = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const supabase = createClient()

  const saveNote = useRef(
    debounce(async (noteId: string, newTitle: string, content: string) => {
      setSaveStatus('saving')

      // Auto-title: derive from content when title is blank or placeholder
      const DEFAULT_NOTE_TITLES = ['', 'Untitled', 'Sin título']
      let finalTitle = newTitle.trim()
      if (DEFAULT_NOTE_TITLES.includes(finalTitle)) {
        // 1. First H1/H2/H3 heading text
        const headingMatch = content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i)
        if (headingMatch) {
          finalTitle = headingMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
        }
        // 2. First 50 chars of plain text
        if (!finalTitle) {
          const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          finalTitle = plain.slice(0, 50).trim()
        }
        // 3. Date fallback: "Nota — 22 de abril" / "Note — April 22"
        if (!finalTitle) {
          const isEs = typeof document !== 'undefined'
            ? (document.documentElement.lang || 'es').startsWith('es')
            : true
          const dateStr = new Date().toLocaleDateString(isEs ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long' })
          finalTitle = isEs ? `Nota — ${dateStr}` : `Note — ${dateStr}`
        }
        setTitle(finalTitle)
      }

      await supabase.from('notes').update({
        title: finalTitle, content,
        updated_at: new Date().toISOString(),
      }).eq('id', noteId)
      const now = new Date().toISOString()
      setLastSaved(now)
      onUpdated(noteId, finalTitle, content)
      setSaveStatus('saved')
    }, 1000)
  ).current

  const editor = useEditor({
    extensions: [StarterKit, ImageNode, TaskList, TaskItem.configure({ nested: true })],
    content: note.content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setSaveStatus('saving')
      saveNote(note.id, title, editor.getHTML())
    },
  })

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    setSaveStatus('saving')
    saveNote(note.id, e.target.value, editor?.getHTML() || '')
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editor?.commands.focus('end')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    setUploadingImage(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingImage(false); return }
    const ext  = file.name.split('.').pop()
    const path = `${user.id}/${note.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('note-images')
      .upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data: signed } = await supabase.storage
        .from('note-images')
        .createSignedUrl(path, 60 * 60 * 24 * 365)
      if (signed?.signedUrl) {
        editor.chain().focus().insertContent({
          type: 'image',
          attrs: { src: signed.signedUrl, alt: file.name },
        }).run()
      }
    }
    setUploadingImage(false)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleSubjectChange = async (subjectId: string | null) => {
    await supabase.from('notes').update({ subject_id: subjectId }).eq('id', note.id)
    onSubjectChanged(note.id, subjectId)
    setSubjectDropdown(false)
  }

  const handleVoiceToggle = () => {
    interface VoiceRecognitionInstance {
      lang: string
      continuous: boolean
      interimResults: boolean
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
      onend: (() => void) | null
      start(): void
      stop(): void
    }
    type VoiceRecognitionCtor = new () => VoiceRecognitionInstance
    const SRCtor = (
      (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    ) as VoiceRecognitionCtor | undefined
    if (!SRCtor) return

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }
    const recognition = new SRCtor()
    recognition.lang = 'es-ES'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) editor?.chain().focus().insertContent(transcript + ' ').run()
    }
    recognition.onend = () => setIsRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const currentSubject = subjects.find(s => s.id === note.subject_id)

  // Heading size config for Notion-style size picker
  const HEADING_SIZES = [
    { level: 0, label: '¶',  size: '11px', weight: '500', title: 'Normal',   active: !editor?.isActive('heading') },
    { level: 3, label: 'A',  size: '12px', weight: '700', title: 'Small',    active: editor?.isActive('heading', { level: 3 }) ?? false },
    { level: 2, label: 'A',  size: '15px', weight: '700', title: 'Medium',   active: editor?.isActive('heading', { level: 2 }) ?? false },
    { level: 1, label: 'A',  size: '19px', weight: '800', title: 'Title',    active: editor?.isActive('heading', { level: 1 }) ?? false },
  ]

  const TOOLBAR: { icon: string; title: string; action: () => void; active: boolean }[] = [
    { icon: 'format_bold',           title: 'Bold',          action: () => editor?.chain().focus().toggleBold().run(),           active: editor?.isActive('bold')        ?? false },
    { icon: 'format_italic',         title: 'Italic',        action: () => editor?.chain().focus().toggleItalic().run(),         active: editor?.isActive('italic')      ?? false },
    { icon: 'format_strikethrough',  title: 'Strikethrough', action: () => editor?.chain().focus().toggleStrike().run(),         active: editor?.isActive('strike')      ?? false },
    { icon: 'code',                  title: 'Code',          action: () => editor?.chain().focus().toggleCode().run(),           active: editor?.isActive('code')        ?? false },
    { icon: 'format_list_bulleted',  title: 'Bullet list',   action: () => editor?.chain().focus().toggleBulletList().run(),     active: editor?.isActive('bulletList')  ?? false },
    { icon: 'format_list_numbered',  title: 'Numbered list', action: () => editor?.chain().focus().toggleOrderedList().run(),    active: editor?.isActive('orderedList') ?? false },
    { icon: 'checklist',             title: 'Checklist',     action: () => editor?.chain().focus().toggleTaskList().run(),       active: editor?.isActive('taskList')    ?? false },
    { icon: 'format_quote',          title: 'Quote',         action: () => editor?.chain().focus().toggleBlockquote().run(),     active: editor?.isActive('blockquote')  ?? false },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center px-4 py-2 gap-2 glass flex-wrap"
        style={{ borderBottom: '1px solid var(--border-subtle)', minHeight: '48px' }}>

        {/* Back button (mobile only) */}
        {onBack && (
          <button onClick={onBack} type="button"
            className="lg:hidden flex items-center gap-1 mr-1 px-2 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--color-primary)' }}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
        )}

        {/* Format tools */}
        <div className="flex items-center gap-0.5 flex-1 flex-wrap">
          {/* Notion-style text size selector */}
          {editor && (
            <div className="flex items-end gap-px mr-1 rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--s-base)' }}>
              {HEADING_SIZES.map(({ level, label, size, weight, title: t2, active }) => {
                const handleClick = () => {
                  if (level === 0) editor.chain().focus().setParagraph().run()
                  else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()
                }
                return (
                  <button key={level} onClick={handleClick} type="button" title={t2}
                    className="px-1.5 py-1 flex items-end justify-center transition-all min-w-[24px]"
                    style={{
                      backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontSize: size,
                      fontWeight: weight,
                      lineHeight: 1,
                    }}
                    aria-pressed={active}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Separator */}
          <span className="w-px h-4 mx-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--border-default)' }} />

          {editor && TOOLBAR.map(({ icon, title, action, active }, i) => (
            <React.Fragment key={icon}>
              {i === 4 && (
                <span className="w-px h-4 mx-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--border-default)' }} />
              )}
              <button onClick={action} type="button" title={title}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{
                  backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                  color:           active ? 'var(--color-primary)' : 'var(--color-outline)',
                }}
                aria-pressed={active}>
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
              </button>
            </React.Fragment>
          ))}

          {/* Image upload */}
          <button
            onClick={() => imageInputRef.current?.click()}
            type="button"
            disabled={uploadingImage}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: 'var(--color-outline)' }}
            title={t('notes.insertImage')}
          >
            <span className="material-symbols-outlined text-[16px]">image</span>
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          {/* Voice input */}
          {hasSpeechRecognition && (
            <>
              <span className="w-px h-4 mx-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: 'var(--border-default)' }} />
              <button
                onClick={handleVoiceToggle}
                type="button"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all relative"
                style={{ color: isRecording ? 'var(--sc-error)' : 'var(--color-outline)' }}
                title={isRecording ? t('notes.voice_stop') : t('notes.voice_start')}
                aria-pressed={isRecording}
              >
                {isRecording && (
                  <span className="absolute inset-0 rounded-lg animate-pulse"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--sc-error) 15%, transparent)' }} />
                )}
                <span className="material-symbols-outlined text-[16px] relative z-10"
                  style={{ fontVariationSettings: isRecording ? "'FILL' 1" : "'FILL' 0" }}>
                  mic
                </span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Subject selector */}
          <div className="relative">
            <button
              onClick={() => setSubjectDropdown(!subjectDropdown)}
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: currentSubject
                  ? `color-mix(in srgb, ${currentSubject.color} 12%, transparent)`
                  : 'var(--s-base)',
                color: currentSubject ? currentSubject.color : 'var(--color-outline)',
              }}
            >
              <span className="material-symbols-outlined text-[13px]">category</span>
              <span className="max-w-[80px] truncate hidden sm:inline">
                {currentSubject?.name || t('notes.noSubject')}
              </span>
              <span className="material-symbols-outlined text-[11px]">expand_more</span>
            </button>
            {subjectDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSubjectDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-default)', boxShadow: '0 8px 32px var(--overlay-bg)' }}>
                  <button
                    onClick={() => handleSubjectChange(null)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-all hover:brightness-110"
                    style={{ color: 'var(--color-outline)' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-outline)' }} />
                    {t('notes.noSubject')}
                  </button>
                  {subjects.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSubjectChange(s.id)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-all hover:brightness-110"
                      style={{ color: s.color }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Save status */}
          <span className="mono text-[10px] hidden sm:flex items-center gap-1" style={{ color: 'var(--color-outline)' }}>
            {saveStatus === 'saving' ? (
              <>
                <span className="material-symbols-outlined text-[13px] animate-pulse-slow">sync</span>
                {t('notes.saving')}
              </>
            ) : (
              `${t('notes.saved')} · ${timeAgo(lastSaved, t)}`
            )}
          </span>
        </div>
      </div>

      {/* Editor canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 lg:px-12 lg:py-10">
          <input
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder={t('notes.untitled')}
            className="text-3xl font-extrabold tracking-tight bg-transparent border-none outline-none mb-6 w-full"
            style={{ color: 'var(--on-surface)' }}
            aria-label="Note title"
          />
          <div
            className="prose prose-sm max-w-none min-h-[200px] focus-within:ring-0"
            style={{ '--tw-prose-body': 'var(--on-surface-variant)', '--tw-prose-headings': 'var(--on-surface)' } as React.CSSProperties}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────
function getPreview(html: string): string {
  if (!html) return ''
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 55 ? text.slice(0, 55) + '…' : text
}

// ── Main page ─────────────────────────────────────────────────────────
export default function NotesPage() {
  const { t, language } = useTranslation()
  const [notes,         setNotes]         = useState<Note[]>([])
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [activeSubject, setActiveSubject] = useState<string>('all')
  const [activeNote,    setActiveNote]    = useState<Note | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [sortMode,      setSortMode]      = useState<'recent' | 'alpha'>('recent')
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [swipeId,       setSwipeId]       = useState<string | null>(null)
  const [swipeOffset,   setSwipeOffset]   = useState(0)
  const [touchStartX,   setTouchStartX]   = useState(0)
  const [pendingCreate, setPendingCreate] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: ns }, { data: ss }] = await Promise.all([
      supabase.from('notes').select('*').order('updated_at', { ascending: false }),
      supabase.from('subjects').select('*').order('name'),
    ])
    setNotes(ns || [])
    setSubjects(uniqueById(ss || []))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-filter by subject or auto-create note when navigated with query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const subjectParam = params.get('subject')
    const newParam = params.get('new')
    if (subjectParam) setActiveSubject(subjectParam)
    if (newParam === '1') setPendingCreate(true)
    if (subjectParam || newParam) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Fire createNote once data is ready and a pending create was requested
  useEffect(() => {
    if (!loading && pendingCreate) {
      setPendingCreate(false)
      createNote()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingCreate])

  const createNote = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('notes').insert({
      user_id: user.id,
      subject_id: activeSubject !== 'all' && activeSubject !== 'none' ? activeSubject : null,
      title: t('notes.untitled'),
      content: '',
    }).select().single()
    if (data) { setNotes(prev => [data, ...prev]); setActiveNote(data) }
  }

  const handleNoteUpdated = (id: string, title: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title, content, updated_at: new Date().toISOString() } : n))
  }

  const handleSubjectChanged = (noteId: string, subjectId: string | null) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, subject_id: subjectId } : n))
  }

  const deleteNote = async (id: string) => {
    setDeletingId(id)
    setTimeout(async () => {
      const supabase = createClient()
      await supabase.from('notes').delete().eq('id', id)
      setNotes(prev => prev.filter(n => n.id !== id))
      if (activeNote?.id === id) setActiveNote(null)
      setDeletingId(null)
    }, 280)
  }

  const subjectFiltered = notes.filter(n => {
    if (activeSubject === 'all')  return true
    if (activeSubject === 'none') return !n.subject_id
    return n.subject_id === activeSubject
  })

  const filteredNotes = [...subjectFiltered].sort((a, b) => {
    if (sortMode === 'alpha') return (a.title || '').localeCompare(b.title || '')
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  const countBySubject  = (id: string) => notes.filter(n => n.subject_id === id).length
  const countNoSubject  = notes.filter(n => !n.subject_id).length

  // Mobile: show editor panel if a note is active
  const mobileShowEditor = !!activeNote

  return (
    <div style={{ height: 'calc(100vh - 4rem)' }} className="flex flex-col animate-fade-in -m-4 lg:-m-8">

      {/* Top header bar — hidden on mobile when editor is open */}
      <div className={`flex items-center justify-between px-5 py-3.5 flex-shrink-0 ${mobileShowEditor ? 'hidden lg:flex' : 'flex'}`}
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <span className="mono text-[10px] tracking-[0.2em] uppercase font-medium block mb-0.5"
            style={{ color: 'var(--color-primary)' }}>Notebook</span>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
            {t('notes.title')}
          </h1>
        </div>
        <button onClick={createNote} className="btn-primary" id="add-note-btn">
          <span className="material-symbols-outlined text-[18px]">edit_note</span>
          <span className="hidden sm:inline">{t('notes.add')}</span>
        </button>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel — hidden on mobile when editor is open */}
        <div className={`flex-shrink-0 flex flex-col overflow-hidden ${mobileShowEditor ? 'hidden lg:flex' : 'flex w-full'} lg:w-64 xl:w-72`}
          style={{ backgroundColor: 'var(--s-low)', borderRight: '1px solid var(--border-subtle)' }}>

          {/* Filter header */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                {filteredNotes.length} {filteredNotes.length === 1 ? t('notes.title').toLowerCase().slice(0, -1) : t('notes.title').toLowerCase()}
              </span>
              <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--s-base)' }}>
                <button
                  onClick={() => setSortMode('recent')}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md transition-all"
                  style={{
                    backgroundColor: sortMode === 'recent' ? 'var(--s-high)' : 'transparent',
                    color: sortMode === 'recent' ? 'var(--on-surface)' : 'var(--color-outline)',
                  }}>
                  {t('notes.sortRecent')}
                </button>
                <button
                  onClick={() => setSortMode('alpha')}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md transition-all"
                  style={{
                    backgroundColor: sortMode === 'alpha' ? 'var(--s-high)' : 'transparent',
                    color: sortMode === 'alpha' ? 'var(--on-surface)' : 'var(--color-outline)',
                  }}>
                  {t('notes.sortAlpha')}
                </button>
              </div>
            </div>

            {/* Subject filter */}
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveSubject('all')}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between"
                style={{
                  backgroundColor: activeSubject === 'all' ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
                  color:           activeSubject === 'all' ? 'var(--color-primary)' : 'var(--color-outline)',
                  borderLeft: `2px solid ${activeSubject === 'all' ? 'var(--color-primary)' : 'transparent'}`,
                }}>
                <span>{t('notes.allSubjects')}</span>
                <span className="mono text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}>
                  {notes.length}
                </span>
              </button>

              {subjects.filter(s => countBySubject(s.id) > 0).map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSubject(s.id)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2"
                  style={{
                    backgroundColor: activeSubject === s.id ? `color-mix(in srgb, ${s.color} 10%, transparent)` : 'transparent',
                    color:           activeSubject === s.id ? s.color : 'var(--color-outline)',
                    borderLeft: `2px solid ${activeSubject === s.id ? s.color : 'transparent'}`,
                  }}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="mono text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}>
                    {countBySubject(s.id)}
                  </span>
                </button>
              ))}

              {countNoSubject > 0 && (
                <button
                  onClick={() => setActiveSubject('none')}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between"
                  style={{
                    backgroundColor: activeSubject === 'none' ? 'color-mix(in srgb, var(--color-outline) 10%, transparent)' : 'transparent',
                    color:           activeSubject === 'none' ? 'var(--on-surface)' : 'var(--color-outline)',
                    borderLeft: activeSubject === 'none' ? '2px solid var(--color-outline)' : '2px solid transparent',
                  }}>
                  <span>{t('notes.noSubjectNotes')}</span>
                  <span className="mono text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}>
                    {countNoSubject}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
            {loading && [1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}

            {!loading && filteredNotes.length === 0 && (
              <div className="text-center py-8 px-4">
                {/* Illustrated empty state */}
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 rounded-full blur-[30px] opacity-25"
                    style={{ backgroundColor: 'var(--color-primary)' }} />
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-default)' }}>
                    {/* Layered notebook icon illusion */}
                    <span className="material-symbols-outlined text-[28px]"
                      style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                      edit_note
                    </span>
                  </div>
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--on-surface)' }}>
                  {activeSubject === 'all'
                    ? (language === 'es' ? 'Aún no tienes notas' : 'No notes yet')
                    : t('notes.noNotes')}
                </p>
                <p className="text-[10px] mb-3" style={{ color: 'var(--color-outline)' }}>
                  {language === 'es'
                    ? 'Crea tu primera nota y empieza a capturar ideas.'
                    : 'Create your first note and start capturing ideas.'}
                </p>
                <button onClick={createNote} className="btn-primary text-xs py-1.5 px-4">
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  {t('notes.add')}
                </button>
              </div>
            )}

            {filteredNotes.map(note => {
              const subj        = subjects.find(s => s.id === note.subject_id)
              const isActive    = activeNote?.id === note.id
              const isDeleting  = deletingId === note.id
              const preview     = getPreview(note.content)
              const accentColor = subj?.color || 'var(--color-primary)'
              const isSwiping   = swipeId === note.id
              const offset      = isSwiping ? swipeOffset : 0
              const THRESHOLD   = 72

              return (
                <div key={note.id}
                  className={`relative rounded-xl overflow-hidden transition-all duration-200 ${isDeleting ? 'opacity-0 scale-95' : ''}`}>
                  {/* Delete zone revealed on swipe */}
                  <div className="absolute inset-0 flex items-center justify-end pr-4 rounded-xl"
                    style={{
                      backgroundColor: 'var(--danger)',
                      opacity: Math.min(Math.abs(offset) / THRESHOLD, 1),
                    }}>
                    <span className="material-symbols-outlined text-white text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}>delete</span>
                  </div>

                  {/* Swipeable note content */}
                  <div
                    className="group/note relative"
                    style={{
                      transform: `translateX(${offset}px)`,
                      transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                      backgroundColor: isActive
                        ? `color-mix(in srgb, ${accentColor} 8%, var(--s-base))`
                        : 'var(--s-dim)',
                      borderLeft: isActive
                        ? `3px solid color-mix(in srgb, ${accentColor} 60%, transparent)`
                        : '3px solid transparent',
                    }}
                    onTouchStart={e => {
                      setSwipeId(note.id)
                      setTouchStartX(e.touches[0].clientX)
                      setSwipeOffset(0)
                    }}
                    onTouchMove={e => {
                      if (swipeId !== note.id) return
                      const dx = e.touches[0].clientX - touchStartX
                      if (dx < 0) setSwipeOffset(Math.max(dx, -THRESHOLD * 1.2))
                    }}
                    onTouchEnd={() => {
                      if (swipeOffset < -THRESHOLD) {
                        deleteNote(note.id)
                      } else {
                        setSwipeOffset(0)
                      }
                      setSwipeId(null)
                    }}
                  >
                    <div className="flex items-stretch">
                      <button onClick={() => setActiveNote(note)}
                        className="flex-1 text-left px-3 py-2.5 rounded-l-xl min-w-0 group-hover/note:bg-[var(--s-base)] transition-colors"
                        style={{ backgroundColor: isActive ? 'transparent' : undefined }}>
                        <div className="flex items-start gap-2">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: subj?.color || 'var(--color-outline)' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                                {note.title || t('notes.untitled')}
                              </p>
                              <span className="mono text-[9px] flex-shrink-0" style={{ color: 'var(--color-outline)' }}>
                                {new Date(note.updated_at).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            {preview && (
                              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-outline)' }}>
                                {preview}
                              </p>
                            )}
                            {subj && (
                              <span className="text-[10px] font-medium mt-0.5 block" style={{ color: subj.color }}>
                                {subj.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      {/* Desktop delete button */}
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="flex-shrink-0 w-8 flex items-center justify-center opacity-0 group-hover/note:opacity-100 transition-opacity hover:bg-red-400/10 rounded-r-xl"
                        style={{ color: 'var(--danger)' }}
                        aria-label="Eliminar nota">
                        <span className="material-symbols-outlined text-[13px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel: editor — full screen on mobile when note is active */}
        <div
          className={`flex-col overflow-hidden ${mobileShowEditor ? 'flex w-full' : 'hidden lg:flex lg:flex-1'} lg:flex-1`}
          style={{ backgroundColor: 'var(--s-dim)' }}>
          {activeNote ? (
            <NoteEditor
              key={activeNote.id}
              note={activeNote}
              subjects={subjects}
              onUpdated={handleNoteUpdated}
              onSubjectChanged={handleSubjectChanged}
              onBack={() => setActiveNote(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="relative inline-block mb-5">
                  <div className="absolute inset-0 rounded-full blur-[50px] opacity-15"
                    style={{ backgroundColor: 'var(--color-primary)' }} />
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-default)' }}>
                    <span className="material-symbols-outlined text-3xl"
                      style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>edit_note</span>
                  </div>
                </div>
                <h2 className="text-base font-bold tracking-tight mb-1" style={{ color: 'var(--on-surface)' }}>
                  Elige una nota
                </h2>
                <p className="text-sm mb-5 max-w-[200px]" style={{ color: 'var(--color-outline)' }}>
                  Selecciónala en la lista o crea una nueva.
                </p>
                <button onClick={createNote} className="btn-primary">
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  {t('notes.add')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
