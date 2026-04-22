'use client'

import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { createClient } from '@/lib/supabase/client'
import { debounce } from '@/lib/utils'
import type { Task } from '@/types'

const MINI_TOOLBAR = (editor: Editor | null) => [
  { icon: 'format_bold',          title: 'Negrita',        action: () => editor?.chain().focus().toggleBold().run(),          active: editor?.isActive('bold')       ?? false },
  { icon: 'format_italic',        title: 'Cursiva',        action: () => editor?.chain().focus().toggleItalic().run(),        active: editor?.isActive('italic')     ?? false },
  { icon: 'format_list_bulleted', title: 'Lista',          action: () => editor?.chain().focus().toggleBulletList().run(),    active: editor?.isActive('bulletList') ?? false },
  { icon: 'checklist',            title: 'Checklist',      action: () => editor?.chain().focus().toggleTaskList().run(),      active: editor?.isActive('taskList')   ?? false },
  { icon: 'format_strikethrough', title: 'Tachado',        action: () => editor?.chain().focus().toggleStrike().run(),       active: editor?.isActive('strike')     ?? false },
]

export function TaskNotes({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const supabase = createClient()

  const save = useRef(
    debounce(async (content: string) => {
      await supabase.from('tasks').update({ notes: content }).eq('id', task.id)
      onSaved()
    }, 1000)
  ).current

  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content: task.notes || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      save(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'outline-none text-xs leading-relaxed min-h-[60px]',
        style: 'color: var(--on-surface-variant)',
      },
    },
  })

  const toolbar = MINI_TOOLBAR(editor)

  return (
    <div
      className="mt-3 rounded-xl animate-slide-up overflow-hidden"
      style={{
        backgroundColor: 'var(--s-base)',
        border: '1px solid var(--border-default)',
      }}
    >
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {toolbar.map(({ icon, title, action, active }) => (
          <button
            key={icon}
            onClick={action}
            type="button"
            title={title}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:brightness-110"
            style={{
              backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
              color: active ? 'var(--color-primary)' : 'var(--color-outline)',
            }}
            aria-pressed={active}
          >
            <span className="material-symbols-outlined text-[14px]">{icon}</span>
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="px-3 py-2.5 max-h-[160px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
