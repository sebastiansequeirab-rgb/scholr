'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { debounce, timeAgo } from '@/lib/utils'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Node, mergeAttributes } from '@tiptap/core'
import type { Note, Subject } from '@/types'

// ── Custom inline image node (no extra package needed) ──────────────
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
}: {
  note: Note
  subjects: Subject[]
  onUpdated: (id: string, title: string, content: string) => void
  onSubjectChanged: (noteId: string, subjectId: string | null) => void
}) {
  const { t } = useTranslation()
  const [title,          setTitle]          = useState(note.title)
  const [saveStatus,     setSaveStatus]     = useState<'saved' | 'saving' | null>('saved')
  const [lastSaved,      setLastSaved]      = useState(note.updated_at)
  const [subjectDropdown, setSubjectDropdown] = useState(false)
  const [uploadingImage,  setUploadingImage]  = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const saveNote = useRef(
    debounce(async (noteId: string, newTitle: string, content: string) => {
      setSaveStatus('saving')
      await supabase.from('notes').update({
        title: newTitle, content,
        updated_at: new Date().toISOString(),
      }).eq('id', noteId)
      const now = new Date().toISOString()
      setLastSaved(now)
      onUpdated(noteId, newTitle, content)
      setSaveStatus('saved')
    }, 1000)
  ).current

  const editor = useEditor({
    extensions: [StarterKit, ImageNode],
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
    // Reset input so same file can be re-uploaded
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleSubjectChange = async (subjectId: string | null) => {
    await supabase.from('notes').update({ subject_id: subjectId }).eq('id', note.id)
    onSubjectChanged(note.id, subjectId)
    setSubjectDropdown(false)
  }

  const currentSubject = subjects.find(s => s.id === note.subject_id)

  const TOOLBAR = [
    { label: 'B',       action: () => editor?.chain().focus().toggleBold().run(),                           active: editor?.isActive('bold')                 ?? false },
    { label: 'I',       action: () => editor?.chain().focus().toggleItalic().run(),                         active: editor?.isActive('italic')               ?? false },
    { label: 'code',    action: () => editor?.chain().focus().toggleCode().run(),                           active: editor?.isActive('code')                 ?? false },
    { label: 'H1',      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),            active: editor?.isActive('heading', { level: 1 }) ?? false },
    { label: 'H2',      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),            active: editor?.isActive('heading', { level: 2 }) ?? false },
    { label: '• List',  action: () => editor?.chain().focus().toggleBulletList().run(),                     active: editor?.isActive('bulletList')            ?? false },
    { label: '1. List', action: () => editor?.chain().focus().toggleOrderedList().run(),                    active: editor?.isActive('orderedList')           ?? false },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 gap-3 glass"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {editor && TOOLBAR.map(({ label, action, active }) => (
            <button key={label} onClick={action} type="button"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                color:           active ? 'var(--color-primary)' : 'var(--color-outline)',
              }}
              aria-pressed={active}>
              {label}
            </button>
          ))}

          {/* Image upload button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            type="button"
            disabled={uploadingImage}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
            style={{ color: 'var(--color-outline)' }}
            title={t('notes.insertImage') || 'Insertar imagen'}
          >
            <span className="material-symbols-outlined text-[14px]">image</span>
            {uploadingImage && <span className="text-[10px]">{t('notes.uploadingImage') || '...'}</span>}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
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
              <span className="max-w-[80px] truncate">{currentSubject?.name || (t('notes.noSubject') || 'Sin materia')}</span>
              <span className="material-symbols-outlined text-[11px]">expand_more</span>
            </button>
            {subjectDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSubjectDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-default)', boxShadow: '0 8px 32px var(--overlay-bg)' }}>
                  <button
                    onClick={() => handleSubjectChange(null)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-110 transition-all"
                    style={{ color: 'var(--color-outline)' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-outline)' }} />
                    {t('notes.noSubject') || 'Sin materia'}
                  </button>
                  {subjects.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSubjectChange(s.id)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:brightness-110 transition-all"
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
          <span className="mono text-[10px]" style={{ color: 'var(--color-outline)' }}>
            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] animate-pulse-slow">sync</span>
                {t('notes.saving')}
              </span>
            ) : (
              `${t('notes.saved')} · ${timeAgo(lastSaved, t)}`
            )}
          </span>
        </div>
      </div>

      {/* Editor canvas */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder={t('notes.untitled')}
          className="text-3xl font-extrabold tracking-tight bg-transparent border-none outline-none mb-6 w-full"
          style={{ color: 'var(--on-surface)' }}
          aria-label="Note title"
        />
        <div
          className="prose prose-sm max-w-none min-h-[300px] focus-within:ring-0"
          style={{ '--tw-prose-body': 'var(--on-surface-variant)', '--tw-prose-headings': 'var(--on-surface)' } as React.CSSProperties}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────
function getPreview(html: string): string {
  if (!html) return ''
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 50 ? text.slice(0, 50) + '…' : text
}

// ── Main page ────────────────────────────────────────────────────────
export default function NotesPage() {
  const { t } = useTranslation()
  const [notes,         setNotes]         = useState<Note[]>([])
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [activeSubject, setActiveSubject] = useState<string>('all')
  const [activeNote,    setActiveNote]    = useState<Note | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [sortMode,      setSortMode]      = useState<'recent' | 'alpha'>('recent')
  const [deletingId,    setDeletingId]    = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: ns }, { data: ss }] = await Promise.all([
      supabase.from('notes').select('*').order('updated_at', { ascending: false }),
      supabase.from('subjects').select('*').order('name'),
    ])
    setNotes(ns || [])
    setSubjects(ss || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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

  // Filter notes by subject
  const subjectFiltered = notes.filter(n => {
    if (activeSubject === 'all')  return true
    if (activeSubject === 'none') return !n.subject_id
    return n.subject_id === activeSubject
  })

  // Sort
  const filteredNotes = [...subjectFiltered].sort((a, b) => {
    if (sortMode === 'alpha') return (a.title || '').localeCompare(b.title || '')
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  // Counts per subject for filter panel
  const countBySubject = (id: string) => notes.filter(n => n.subject_id === id).length
  const countNoSubject = notes.filter(n => !n.subject_id).length

  return (
    <div style={{ height: 'calc(100vh - 4rem)' }} className="flex flex-col animate-fade-in -m-4 lg:-m-8">

      {/* Top header bar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
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
          {t('notes.add')}
        </button>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel: filter + note list */}
        <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
          style={{ backgroundColor: 'var(--s-low)', borderRight: '1px solid var(--border-subtle)' }}>

          {/* Filter header */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                {filteredNotes.length} {filteredNotes.length === 1 ? 'nota' : 'notas'}
              </span>
              {/* Sort toggle */}
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--s-base)' }}>
                <button
                  onClick={() => setSortMode('recent')}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md transition-all"
                  style={{
                    backgroundColor: sortMode === 'recent' ? 'var(--s-high)' : 'transparent',
                    color: sortMode === 'recent' ? 'var(--on-surface)' : 'var(--color-outline)',
                  }}>
                  {t('notes.sortRecent') || 'Recientes'}
                </button>
                <button
                  onClick={() => setSortMode('alpha')}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md transition-all"
                  style={{
                    backgroundColor: sortMode === 'alpha' ? 'var(--s-high)' : 'transparent',
                    color: sortMode === 'alpha' ? 'var(--on-surface)' : 'var(--color-outline)',
                  }}>
                  {t('notes.sortAlpha') || 'A-Z'}
                </button>
              </div>
            </div>

            {/* Subject filter chips */}
            <div className="space-y-1">
              {/* All */}
              <button
                onClick={() => setActiveSubject('all')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between"
                style={{
                  backgroundColor: activeSubject === 'all' ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--s-base)',
                  color:           activeSubject === 'all' ? 'var(--color-primary)' : 'var(--color-outline)',
                  borderLeft: activeSubject === 'all' ? `2px solid var(--color-primary)` : '2px solid transparent',
                }}>
                <span>{t('notes.allSubjects') || 'Todas las materias'}</span>
                <span className="mono text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--s-highest, var(--s-high))', color: 'var(--color-outline)' }}>
                  {notes.length}
                </span>
              </button>

              {/* Subject chips */}
              {subjects.filter(s => countBySubject(s.id) > 0).map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSubject(s.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between"
                  style={{
                    backgroundColor: activeSubject === s.id ? `color-mix(in srgb, ${s.color} 10%, transparent)` : 'var(--s-base)',
                    color:           activeSubject === s.id ? s.color : 'var(--color-outline)',
                    borderLeft: `2px solid ${activeSubject === s.id ? s.color : 'transparent'}`,
                  }}>
                  <span className="truncate">{s.name}</span>
                  <span className="mono text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--s-highest, var(--s-high))', color: 'var(--color-outline)' }}>
                    {countBySubject(s.id)}
                  </span>
                </button>
              ))}

              {/* No subject chip */}
              {countNoSubject > 0 && (
                <button
                  onClick={() => setActiveSubject('none')}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between"
                  style={{
                    backgroundColor: activeSubject === 'none' ? 'color-mix(in srgb, var(--color-outline) 10%, transparent)' : 'var(--s-base)',
                    color:           activeSubject === 'none' ? 'var(--on-surface)' : 'var(--color-outline)',
                    borderLeft: activeSubject === 'none' ? '2px solid var(--color-outline)' : '2px solid transparent',
                  }}>
                  <span>{t('notes.noSubjectNotes') || 'Sin materia'}</span>
                  <span className="mono text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--s-highest, var(--s-high))', color: 'var(--color-outline)' }}>
                    {countNoSubject}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {loading && [1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}

            {!loading && filteredNotes.length === 0 && (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: 'var(--color-outline)' }}>
                  description
                </span>
                <p className="text-xs" style={{ color: 'var(--color-outline)' }}>{t('notes.noNotes')}</p>
              </div>
            )}

            {filteredNotes.map(note => {
              const subj       = subjects.find(s => s.id === note.subject_id)
              const isActive   = activeNote?.id === note.id
              const isDeleting = deletingId === note.id
              const preview    = getPreview(note.content)
              const accentColor = subj?.color || 'var(--color-primary)'
              return (
                <div key={note.id}
                  className={`group/note relative rounded-xl transition-all duration-200 ${isDeleting ? 'opacity-0 scale-95' : ''}`}
                  style={{
                    backgroundColor: isActive ? `color-mix(in srgb, ${accentColor} 8%, var(--s-base))` : 'transparent',
                    border: isActive
                      ? `1px solid color-mix(in srgb, ${accentColor} 22%, transparent)`
                      : '1px solid transparent',
                    borderLeft: isActive
                      ? `3px solid color-mix(in srgb, ${accentColor} 60%, transparent)`
                      : '3px solid transparent',
                  }}>
                  <button onClick={() => setActiveNote(note)}
                    className="w-full text-left px-3 py-2.5 rounded-xl group-hover/note:bg-[var(--s-base)] transition-colors"
                    style={{ backgroundColor: isActive ? 'transparent' : undefined }}>
                    <div className="flex items-start gap-2.5 pr-5">
                      {/* Color dot */}
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: subj?.color || 'var(--color-outline)' }} />
                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                            {note.title || t('notes.untitled')}
                          </p>
                          <span className="mono text-[9px] flex-shrink-0" style={{ color: 'var(--color-outline)' }}>
                            {new Date(note.updated_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {/* Preview line */}
                        {preview && (
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-outline)' }}>
                            {preview}
                          </p>
                        )}
                        {/* Subject label */}
                        {subj && (
                          <span className="text-[10px] font-medium mt-0.5 block" style={{ color: subj.color }}>
                            {subj.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover/note:opacity-100 transition-opacity hover:bg-red-400/10"
                    style={{ color: 'var(--danger)' }}
                    aria-label="Eliminar nota">
                    <span className="material-symbols-outlined text-[13px]">delete</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel: editor */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--s-dim)' }}>
          {activeNote ? (
            <NoteEditor
              key={activeNote.id}
              note={activeNote}
              subjects={subjects}
              onUpdated={handleNoteUpdated}
              onSubjectChanged={handleSubjectChanged}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 rounded-full blur-[50px] opacity-15"
                    style={{ backgroundColor: 'var(--color-primary)' }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-default)' }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>edit_note</span>
                  </div>
                </div>
                <h2 className="text-lg font-bold tracking-tight mb-1.5" style={{ color: 'var(--on-surface)' }}>
                  Elige una nota
                </h2>
                <p className="text-sm mb-6 max-w-[220px]" style={{ color: 'var(--color-outline)' }}>
                  Selecciónala en la lista o crea una nueva ahora.
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
