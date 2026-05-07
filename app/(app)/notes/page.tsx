'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { debounce, relativeNoteDate, uniqueById } from '@/lib/utils'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Underline } from '@tiptap/extension-underline'
import { Highlight } from '@tiptap/extension-highlight'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Mathematics } from '@tiptap/extension-mathematics'
import { Node, mergeAttributes } from '@tiptap/core'
import type { Note, Subject } from '@/types'
import type { AppContext } from '@/features/ai/types'

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
    return ['img', mergeAttributes(HTMLAttributes, { class: 'note-image' })]
  },
})

// ── Helpers ──────────────────────────────────────────────────────────
function getPlainText(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function getPreview(html: string, max = 140): string {
  const text = getPlainText(html)
  return text.length > max ? text.slice(0, max) + '…' : text
}

function subjectAbbr(name: string): string {
  if (!name) return ''
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase()
}

const ORPHAN_FOLDER = '__orphan__'

// ── Title with dual-style render (sans-bold prefix + serif italic info suffix) ──
function TitleField({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  placeholder: string
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // Split on em-dash with optional spaces around it
  const splitMatch = value.match(/^(.*?)(\s*—\s*)(.*)$/)

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { setEditing(false); onCommit() }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); setEditing(false); onCommit() }
          if (e.key === 'Escape') { setEditing(false); onCommit() }
        }}
        placeholder={placeholder}
        className="notes-editor-v2__title-input"
        aria-label="Note title"
      />
    )
  }

  return (
    <div
      className="notes-editor-v2__title-display"
      onClick={() => setEditing(true)}
      role="textbox"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') setEditing(true) }}
    >
      {value
        ? splitMatch
          ? <>
              <span className="title-prefix">{splitMatch[1]}</span>
              <span className="title-dash">{splitMatch[2]}</span>
              <span className="title-suffix">{splitMatch[3]}</span>
            </>
          : <span className="title-prefix">{value}</span>
        : <span style={{ color: 'var(--on-surface-variant)', opacity: .55 }}>{placeholder}</span>}
    </div>
  )
}

// ── Toolbar dropdown for paragraph / heading levels ─────────────────
function HeadingDropdown({ editor, t }: { editor: Editor | null; t: (k: string) => string }) {
  const [open, setOpen] = useState(false)
  if (!editor) return null

  const current = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3'
    : 'p'
  const label = current === 'p' ? t('notes.toolbar.normal')
    : current === 'h1' ? t('notes.toolbar.h1')
    : current === 'h2' ? t('notes.toolbar.h2')
    : t('notes.toolbar.h3')

  const apply = (kind: 'p' | 'h1' | 'h2' | 'h3') => {
    if (kind === 'p') editor.chain().focus().setParagraph().run()
    else editor.chain().focus().toggleHeading({ level: Number(kind[1]) as 1 | 2 | 3 }).run()
    setOpen(false)
  }

  return (
    <div className="note-toolbar-v2__select-wrap">
      <button type="button" className="note-toolbar-v2__select" onClick={() => setOpen(o => !o)}>
        {label}
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="note-toolbar-v2__select-menu">
            {(['p', 'h1', 'h2', 'h3'] as const).map(k => (
              <button
                key={k}
                type="button"
                className={`note-toolbar-v2__select-item${current === k ? ' is-active' : ''}`}
                onClick={() => apply(k)}
              >
                {k === 'p' ? t('notes.toolbar.normal')
                  : k === 'h1' ? t('notes.toolbar.h1')
                  : k === 'h2' ? t('notes.toolbar.h2')
                  : t('notes.toolbar.h3')}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── AI sparkles popover ─────────────────────────────────────────────
function AIPopover({
  editor,
  note,
  subjects,
  language,
  onClose,
}: {
  editor: Editor | null
  note: Note
  subjects: Subject[]
  language: 'es' | 'en'
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const submit = async (instruction: string) => {
    if (!editor || !instruction.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('no_session')

      const noteText = getPlainText(editor.getHTML())
      const message =
        `${instruction.trim()}\n\n---\n${language === 'es' ? 'Nota actual' : 'Current note'}:\n${noteText.slice(0, 4000)}`

      const app_context: AppContext = {
        current_page: 'notes',
        active_subject_id: note.subject_id ?? undefined,
        language,
        subject_count: subjects.length,
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: [],
          app_context,
          access_token: session.access_token,
        }),
      })
      if (!res.ok) throw new Error(`status_${res.status}`)
      const data: { reply?: string } = await res.json()
      const reply = (data.reply || '').trim()
      if (!reply) throw new Error('empty_reply')

      editor.chain().focus().insertContent('\n\n' + reply).run()
      onClose()
    } catch {
      setError(t('notes.ai.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="note-ai-popover" onClick={e => e.stopPropagation()}>
      <input
        autoFocus
        type="text"
        className="note-ai-popover__input"
        placeholder={t('notes.ai.placeholder')}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(prompt) }
          if (e.key === 'Escape') onClose()
        }}
        disabled={loading}
      />
      <div className="note-ai-popover__chips">
        <button
          type="button"
          className="note-ai-popover__chip"
          disabled={loading}
          onClick={() => submit(t('notes.ai.suggest_summary'))}
        >
          {t('notes.ai.suggest_summary')}
        </button>
        <button
          type="button"
          className="note-ai-popover__chip"
          disabled={loading}
          onClick={() => submit(t('notes.ai.suggest_improve'))}
        >
          {t('notes.ai.suggest_improve')}
        </button>
      </div>
      {loading && <div className="text-[11px]" style={{ color: 'var(--on-surface-variant)' }}>{t('notes.ai.loading')}</div>}
      {error && <div className="note-ai-popover__error">{error}</div>}
    </div>
  )
}

// ── Note editor ──────────────────────────────────────────────────────
function NoteEditor({
  note,
  subjects,
  notesInFolder,
  onUpdated,
  onDelete,
  onBack,
}: {
  note: Note
  subjects: Subject[]
  notesInFolder: number
  onUpdated: (id: string, title: string, content: string) => void
  onDelete: () => void
  onBack?: () => void
}) {
  const { t, language } = useTranslation()
  const lang = language as 'es' | 'en'
  const [title,        setTitle]        = useState(note.title)
  const [saveStatus,   setSaveStatus]   = useState<'saved' | 'saving' | null>('saved')
  const [lastSaved,    setLastSaved]    = useState(note.updated_at)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [aiOpen,       setAiOpen]       = useState(false)
  const [moreOpen,     setMoreOpen]     = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const supabase = createClient()

  // Force re-render every minute so the eyebrow "última edición" stays current
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const saveNote = useRef(
    debounce(async (noteId: string, newTitle: string, content: string) => {
      setSaveStatus('saving')
      const DEFAULT_NOTE_TITLES = ['', 'Untitled', 'Sin título']
      let finalTitle = newTitle.trim()
      if (DEFAULT_NOTE_TITLES.includes(finalTitle)) {
        const headingMatch = content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i)
        if (headingMatch) {
          finalTitle = headingMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
        }
        if (!finalTitle) {
          const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          finalTitle = plain.slice(0, 50).trim()
        }
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
    }, 2000)
  ).current

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      ImageNode,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Mathematics,
    ],
    content: note.content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setSaveStatus('saving')
      saveNote(note.id, title, editor.getHTML())
    },
  })

  // Reset state when switching to a different note
  useEffect(() => {
    setTitle(note.title)
    setLastSaved(note.updated_at)
    setSaveStatus('saved')
    setAiOpen(false)
    setMoreOpen(false)
  }, [note.id, note.title, note.updated_at])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    setSaveStatus('saving')
    saveNote(note.id, v, editor?.getHTML() || '')
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
    recognition.lang = lang === 'es' ? 'es-ES' : 'en-US'
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

  const eyebrow = useMemo(() => {
    const abbr = currentSubject ? subjectAbbr(currentSubject.name) : (lang === 'es' ? 'NOTA' : 'NOTE')
    const countLabel = (notesInFolder === 1 ? t('notes.countLabelOne') : t('notes.countLabel'))
      .replace('{n}', String(notesInFolder))
      .toUpperCase()
    const lastWhen = saveStatus === 'saving'
      ? t('notes.editor.savingShort').toUpperCase()
      : t('notes.editor.lastEdited').replace('{when}', relativeNoteDate(lastSaved, lang)).toUpperCase()
    return `${abbr} · ${countLabel} · ${lastWhen}`
  }, [currentSubject, notesInFolder, saveStatus, lastSaved, t, lang])

  const insertFormula = () => {
    if (!editor) return
    const latex = window.prompt(lang === 'es' ? 'Fórmula LaTeX' : 'LaTeX formula', 'E = mc^2')
    if (!latex) return
    editor.chain().focus().insertInlineMath({ latex }).run()
  }

  return (
    <div className="notes-editor-v2">
      {/* Top: eyebrow + actions */}
      <div className="notes-editor-v2__top">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="lg:hidden notes-editor-v2__icon-btn"
              aria-label="Volver"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <span className="notes-editor-v2__eyebrow truncate">{eyebrow}</span>
        </div>
        <div className="notes-editor-v2__actions">
          <button
            type="button"
            className="notes-editor-v2__icon-btn"
            title={t('notes.editor.share')}
            aria-label={t('notes.editor.share')}
          >
            <span className="material-symbols-outlined">ios_share</span>
          </button>
          <button
            type="button"
            className="notes-editor-v2__icon-btn"
            title={t('notes.editor.more')}
            aria-label={t('notes.editor.more')}
            onClick={() => setMoreOpen(o => !o)}
          >
            <span className="material-symbols-outlined">more_horiz</span>
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
              <div className="note-toolbar-v2__select-menu" style={{ top: 'calc(100% + 6px)', right: 0, left: 'auto' }}>
                <button
                  type="button"
                  className="note-toolbar-v2__select-item"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => { setMoreOpen(false); onDelete() }}
                >
                  {t('notes.editor.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="notes-editor-v2__title-wrap">
        <TitleField
          value={title}
          onChange={handleTitleChange}
          onCommit={() => { /* save already debounced */ }}
          placeholder={t('notes.untitled')}
        />
      </div>

      {/* Toolbar */}
      <div className="note-toolbar-v2">
        <HeadingDropdown editor={editor} t={t} />
        <span className="note-toolbar-v2__sep" />

        {/* Group 1: bold / italic / underline / strike / highlight */}
        <div className="note-toolbar-v2__group">
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('bold') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title={t('notes.toolbar.bold')}
          >
            <span className="material-symbols-outlined">format_bold</span>
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('italic') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title={t('notes.toolbar.italic')}
          >
            <span className="material-symbols-outlined">format_italic</span>
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('underline') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            title={t('notes.toolbar.underline')}
          >
            <span className="material-symbols-outlined">format_underlined</span>
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('strike') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            title={t('notes.toolbar.strike')}
          >
            <span className="material-symbols-outlined">format_strikethrough</span>
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('highlight') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
            title={t('notes.toolbar.highlight')}
          >
            <span className="material-symbols-outlined">format_ink_highlighter</span>
          </button>
        </div>

        <span className="note-toolbar-v2__sep" />

        {/* Group 2: lists / indent / checklist */}
        <div className="note-toolbar-v2__group">
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('bulletList') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            title={t('notes.toolbar.bullet')}
          >
            <span className="material-symbols-outlined">format_list_bulleted</span>
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('orderedList') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            title={t('notes.toolbar.numbered')}
          >
            <span className="material-symbols-outlined">format_list_numbered</span>
          </button>
          <button
            type="button"
            className="note-toolbar-v2__btn"
            onClick={() => editor?.chain().focus().sinkListItem('listItem').run()}
            title={t('notes.toolbar.indent')}
          >
            <span className="material-symbols-outlined">format_indent_increase</span>
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('taskList') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            title={t('notes.toolbar.checklist')}
          >
            <span className="material-symbols-outlined">checklist</span>
          </button>
        </div>

        <span className="note-toolbar-v2__sep" />

        {/* Group 3: formula / code / quote / table */}
        <div className="note-toolbar-v2__group">
          <button
            type="button"
            className="note-toolbar-v2__btn"
            onClick={insertFormula}
            title={t('notes.toolbar.formula')}
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14 }}
          >
            fx
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('code') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleCode().run()}
            title={t('notes.toolbar.code')}
          >
            <span className="material-symbols-outlined">code</span>
          </button>
          <button
            type="button"
            className={`note-toolbar-v2__btn${editor?.isActive('blockquote') ? ' is-active' : ''}`}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            title={t('notes.toolbar.quote')}
          >
            <span className="material-symbols-outlined">format_quote</span>
          </button>
          <button
            type="button"
            className="note-toolbar-v2__btn"
            onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title={t('notes.toolbar.table')}
          >
            <span className="material-symbols-outlined">grid_on</span>
          </button>
        </div>

        <span className="note-toolbar-v2__sep" />

        {/* Group 4: attach / image / mic / sparkles */}
        <div className="note-toolbar-v2__group">
          <button
            type="button"
            className="note-toolbar-v2__btn"
            title={t('notes.toolbar.attach')}
            disabled
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <button
            type="button"
            className="note-toolbar-v2__btn"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            title={t('notes.toolbar.image')}
          >
            <span className="material-symbols-outlined">image</span>
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          {hasSpeechRecognition && (
            <button
              type="button"
              className="note-toolbar-v2__btn"
              onClick={handleVoiceToggle}
              title={isRecording ? t('notes.voice_stop') : t('notes.voice_start')}
              style={isRecording ? { color: 'var(--danger)' } : undefined}
              aria-pressed={isRecording}
            >
              <span className="material-symbols-outlined">mic</span>
            </button>
          )}
          <button
            type="button"
            className={`note-toolbar-v2__btn note-toolbar-v2__btn--ai${aiOpen ? ' is-active' : ''}`}
            onClick={() => setAiOpen(o => !o)}
            title={t('notes.toolbar.ai')}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </button>
        </div>
      </div>

      {/* AI popover (positioned relative to body) */}
      {aiOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAiOpen(false)} />
          <AIPopover
            editor={editor}
            note={note}
            subjects={subjects}
            language={lang}
            onClose={() => setAiOpen(false)}
          />
        </>
      )}

      {/* Body */}
      <div className="notes-editor-v2__body">
        <div className="note-prose">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function NotesPage() {
  const { t, language } = useTranslation()
  const lang = language as 'es' | 'en'
  const [notes,         setNotes]         = useState<Note[]>([])
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [activeFolder,  setActiveFolder]  = useState<string | null>(null)
  const [activeNote,    setActiveNote]    = useState<Note | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [sortMode,      setSortMode]      = useState<'recent' | 'alpha'>('recent')
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
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

  // Lock body scroll while /notes is mounted (shell is position: fixed on desktop)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  // ?subject= and ?new= handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const subjectParam = params.get('subject')
    const newParam = params.get('new')
    if (subjectParam) setActiveFolder(subjectParam)
    if (newParam === '1') setPendingCreate(true)
    if (subjectParam || newParam) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Compute folders (subjects with at least 1 note + optional orphan folder)
  const folders = useMemo(() => {
    const counts = new Map<string, number>()
    let orphan = 0
    for (const n of notes) {
      if (n.subject_id) counts.set(n.subject_id, (counts.get(n.subject_id) || 0) + 1)
      else orphan += 1
    }
    const list = subjects
      .filter(s => counts.has(s.id))
      .map(s => ({ id: s.id, name: s.name, color: s.color, count: counts.get(s.id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (orphan > 0) {
      list.push({
        id: ORPHAN_FOLDER,
        name: t('notes.noSubject'),
        color: 'var(--color-outline)',
        count: orphan,
      })
    }
    return list
  }, [notes, subjects, t])

  // Default folder when data loads or current folder disappears
  useEffect(() => {
    if (loading) return
    if (folders.length === 0) { setActiveFolder(null); return }
    if (!activeFolder || !folders.some(f => f.id === activeFolder)) {
      setActiveFolder(folders[0].id)
    }
  }, [loading, folders, activeFolder])

  const createNote = useCallback(async (preferredFolder?: string | null) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const folder = preferredFolder ?? activeFolder
    const subject_id = folder && folder !== ORPHAN_FOLDER ? folder : null
    const { data } = await supabase.from('notes').insert({
      user_id: user.id,
      subject_id,
      title: t('notes.untitled'),
      content: '',
    }).select().single()
    if (data) {
      setNotes(prev => [data, ...prev])
      setActiveNote(data)
      if (subject_id) setActiveFolder(subject_id)
      else setActiveFolder(ORPHAN_FOLDER)
    }
  }, [activeFolder, t])

  // Fire createNote once data is ready and a pending create was requested
  useEffect(() => {
    if (!loading && pendingCreate) {
      setPendingCreate(false)
      createNote()
    }
  }, [loading, pendingCreate, createNote])

  const handleNoteUpdated = (id: string, title: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title, content, updated_at: new Date().toISOString() } : n))
  }

  const deleteNote = async (id: string) => {
    setDeletingId(id)
    setTimeout(async () => {
      const supabase = createClient()
      await supabase.from('notes').delete().eq('id', id)
      setNotes(prev => prev.filter(n => n.id !== id))
      if (activeNote?.id === id) setActiveNote(null)
      setDeletingId(null)
    }, 200)
  }

  // Notes filtered to active folder, sorted
  const filteredNotes = useMemo(() => {
    const filt = notes.filter(n => {
      if (activeFolder === ORPHAN_FOLDER) return !n.subject_id
      if (activeFolder) return n.subject_id === activeFolder
      return true
    })
    return [...filt].sort((a, b) => {
      if (sortMode === 'alpha') return (a.title || '').localeCompare(b.title || '')
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [notes, activeFolder, sortMode])

  const activeFolderObj = folders.find(f => f.id === activeFolder)
  const activeFolderName = activeFolderObj?.name || ''
  const activeFolderAbbr = activeFolderObj
    ? (activeFolder === ORPHAN_FOLDER ? (lang === 'es' ? 'OTROS' : 'OTHER') : subjectAbbr(activeFolderName))
    : ''

  const listEyebrow = activeFolderObj
    ? `${activeFolderAbbr} · ${activeFolderName.toUpperCase()}`
    : ''

  const countText = (filteredNotes.length === 1 ? t('notes.countLabelOne') : t('notes.countLabel'))
    .replace('{n}', String(filteredNotes.length))

  // Mobile show editor when a note is active
  const mobileShowEditor = !!activeNote

  return (
    <div
      className="notes-shell-v2"
      style={{
        // Mobile view-toggle via CSS vars consumed by .notes-list-v2 / .notes-editor-v2
        ['--notes-list-display' as string]: mobileShowEditor ? 'none' : 'flex',
        ['--notes-editor-display' as string]: mobileShowEditor ? 'flex' : 'none',
      }}
    >
      {/* Pane 1 — Folders */}
      <aside className="notes-folders-v2">
        <div className="notes-folders-v2__head">
          <span className="kicker">{t('notes.folders')}</span>
          <Link
            href="/subjects"
            className="notes-folders-v2__add"
            title={t('notes.newFolder')}
            aria-label={t('notes.newFolder')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          </Link>
        </div>

        {loading && [1,2,3,4].map(i => <div key={i} className="skeleton h-9 mx-2 rounded" />)}

        {!loading && folders.length === 0 && (
          <p className="text-xs px-3 py-2" style={{ color: 'var(--on-surface-variant)' }}>
            {lang === 'es' ? 'Crea tu primera materia para empezar.' : 'Create your first subject to begin.'}
          </p>
        )}

        {folders.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setActiveFolder(f.id); setActiveNote(null) }}
            className={`folder-v2${activeFolder === f.id ? ' is-active' : ''}`}
            style={{ ['--folder-color' as string]: f.color }}
          >
            <span className="folder-v2__dot" />
            <span className="folder-v2__name">{f.name}</span>
            <span className="folder-v2__count">{f.count}</span>
          </button>
        ))}
      </aside>

      {/* Pane 2 — Notes list */}
      <section className="notes-list-v2">
        <div className="notes-list-v2__head">
          {listEyebrow && <span className="kicker">{listEyebrow}</span>}
          <div className="notes-list-v2__title-row">
            <h2 className="notes-list-v2__title">{countText}</h2>
            <button
              type="button"
              className="btn-new"
              onClick={() => createNote()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              <span>{t('notes.newShort')}</span>
            </button>
          </div>
          <div className="notes-list-v2__sort-row">
            <div className="seg" style={{ display: 'inline-flex' }}>
              <button
                type="button"
                className={`seg__btn${sortMode === 'recent' ? ' is-active' : ''}`}
                onClick={() => setSortMode('recent')}
              >
                {t('notes.sortRecent')}
              </button>
              <button
                type="button"
                className={`seg__btn${sortMode === 'alpha' ? ' is-active' : ''}`}
                onClick={() => setSortMode('alpha')}
              >
                {t('notes.sortAlpha')}
              </button>
            </div>
          </div>
        </div>

        <div className="notes-list-v2__items">
          {loading && [1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}

          {!loading && filteredNotes.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--on-surface)' }}>
                {lang === 'es' ? 'Aún no tienes notas' : 'No notes yet'}
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--on-surface-variant)' }}>
                {lang === 'es'
                  ? 'Crea tu primera nota y empieza a capturar ideas.'
                  : 'Create your first note and start capturing ideas.'}
              </p>
              <button onClick={() => createNote()} className="btn-new">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                {t('notes.newShort')}
              </button>
            </div>
          )}

          {filteredNotes.map(note => {
            const isActive = activeNote?.id === note.id
            const isDeleting = deletingId === note.id
            const preview = getPreview(note.content)

            return (
              <button
                key={note.id}
                type="button"
                onClick={() => setActiveNote(note)}
                className={`note-card-v2${isActive ? ' is-active' : ''} ${isDeleting ? 'opacity-0 scale-95' : ''}`}
              >
                <div className="note-card-v2__title">
                  {note.title || t('notes.untitled')}
                </div>
                <div className="note-card-v2__date">
                  {relativeNoteDate(note.updated_at, lang)}
                </div>
                {preview && <div className="note-card-v2__snippet">{preview}</div>}
              </button>
            )
          })}
        </div>
      </section>

      {/* Pane 3 — Editor */}
      <section className="notes-editor-v2">
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            subjects={subjects}
            notesInFolder={filteredNotes.length}
            onUpdated={handleNoteUpdated}
            onDelete={() => deleteNote(activeNote.id)}
            onBack={() => setActiveNote(null)}
          />
        ) : (
          <div className="notes-editor-v2__empty">
            <div className="notes-editor-v2__empty-inner">
              <div className="notes-editor-v2__empty-icon">
                <span className="material-symbols-outlined">edit_note</span>
              </div>
              <h2 className="notes-editor-v2__empty-title">{t('notes.empty.title')}</h2>
              <p className="notes-editor-v2__empty-sub">{t('notes.empty.sub')}</p>
              <button onClick={() => createNote()} className="btn-new">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                {t('notes.empty.cta')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
