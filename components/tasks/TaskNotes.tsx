'use client'

import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createClient } from '@/lib/supabase/client'
import { debounce } from '@/lib/utils'
import type { Task } from '@/types'

export function TaskNotes({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const supabase = createClient()

  const save = useRef(
    debounce(async (content: string) => {
      await supabase.from('tasks').update({ notes: content }).eq('id', task.id)
      onSaved()
    }, 1000)
  ).current

  const editor = useEditor({
    extensions: [StarterKit],
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

  return (
    <div
      className="mt-3 p-3 rounded-xl animate-slide-up overflow-y-auto"
      style={{
        backgroundColor: 'var(--s-base)',
        border: '1px solid var(--border-default)',
        maxHeight: '160px',
      }}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
