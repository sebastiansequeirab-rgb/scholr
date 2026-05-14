'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useTranslation } from '@/hooks/useTranslation'
import { subjectTag } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { computeAlertDueLabel, computeWeightedAvg, subjectInfo } from '@/lib/meta'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'
import { SideDrawer } from '@/components/ui/SideDrawer'
import type { Exam, Subject, Task } from '@/types'

type TaskCol = 'pending' | 'doing' | 'done'

const COLS: TaskCol[] = ['pending', 'doing', 'done']

// ─── Status ↔ Col mapping ────────────────────────────────────────────────
function statusToCol(s: Task['status']): TaskCol {
  if (s === 'in_progress') return 'doing'
  if (s === 'done') return 'done'
  return 'pending'
}
function colToStatus(c: TaskCol): Task['status'] {
  if (c === 'doing') return 'in_progress'
  if (c === 'done') return 'done'
  return 'not_started'
}

// ─── Display helpers ─────────────────────────────────────────────────────
function formatDue(task: Task, lang: 'es' | 'en'): string {
  if (task.is_done && task.done_at) {
    const days = Math.floor((Date.now() - new Date(task.done_at).getTime()) / 86400000)
    if (days <= 0) return lang === 'es' ? 'Hoy' : 'Today'
    if (days === 1) return lang === 'es' ? 'Hace 1 día' : '1d ago'
    return lang === 'es' ? `Hace ${days} días` : `${days}d ago`
  }
  if (!task.due_date) return lang === 'es' ? 'Sin fecha' : 'No date'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(task.due_date + 'T00:00:00')
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) {
    const past = -diff
    return lang === 'es' ? `Hace ${past} d` : `${past}d ago`
  }
  if (diff === 0) return lang === 'es' ? 'Hoy' : 'Today'
  if (diff === 1) return lang === 'es' ? 'Mañana' : 'Tomorrow'
  if (diff < 7) {
    return due.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' })
      .replace('.', '')
  }
  return due.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })
}

function PrioBadge({ p }: { p: Task['priority'] }) {
  const { t } = useTranslation()
  const cls =
    p === 'high' ? 'badge--prio-high' :
    p === 'mid'  ? 'badge--prio-mid' :
                   'badge--prio-low'
  const label =
    p === 'high' ? t('tareas.priority.high') :
    p === 'mid'  ? t('tareas.priority.mid') :
                   t('tareas.priority.low')
  return <span className={`badge ${cls}`}>{label}</span>
}

// ─── Card visual ─────────────────────────────────────────────────────────
function TaskCardInner({ task, subjects }: { task: Task; subjects: Subject[] }) {
  const { language } = useTranslation()
  const info = subjectInfo(task.subject_id, subjects)
  const col = statusToCol(task.status)
  const isDone = col === 'done'
  return (
    <>
      <div className="kan-card__head">
        <span className="subj-chip">{info.code}</span>
        <PrioBadge p={task.priority} />
      </div>

      <div className="kan-card__title">{task.text}</div>

      <div className="kan-card__foot">
        <span className="material-symbols-outlined">schedule</span>
        <span>{formatDue(task, language)}</span>
      </div>

      {isDone && (
        <span className="kan-card__check" aria-hidden>
          <span className="material-symbols-outlined">check</span>
        </span>
      )}
    </>
  )
}

function SortableTaskCard({
  task,
  subjects,
  onOpen,
  onDelete,
  onMove,
}: {
  task: Task
  subjects: Subject[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: 1 | -1) => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { col: statusToCol(task.status) },
  })
  const info = subjectInfo(task.subject_id, subjects)
  const tagClass = subjectTag(info.color)
  const col = statusToCol(task.status)
  const isDone = col === 'done'
  const colIdx = COLS.indexOf(col)
  const canBack = colIdx > 0
  const canNext = colIdx < COLS.length - 1
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => { if (!isDragging) onOpen(task.id) }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isDragging) {
          e.preventDefault()
          onOpen(task.id)
        }
      }}
      className={`kan-card kan-card--v2 ${tagClass}${isDone ? ' is-done' : ''}${isDragging ? ' is-dragging' : ''}${task.priority === 'high' ? ' is-prio-high' : task.priority === 'low' ? ' is-prio-low' : ' is-prio-mid'}`}
    >
      <span className="kan-card__grip" aria-hidden>
        <span className="material-symbols-outlined">drag_indicator</span>
      </span>
      <button
        type="button"
        className="kan-card__delete"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
        aria-label={t('tareas.deleteAria')}
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      <TaskCardInner task={task} subjects={subjects} />
      <div className="kan-card__nav" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="kan-card__nav-btn"
          onClick={(e) => { e.stopPropagation(); if (canBack) onMove(task.id, -1) }}
          disabled={!canBack}
          aria-label="Anterior"
          title={canBack ? `← ${t(`tareas.cols.${COLS[colIdx - 1]}`)}` : ''}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          type="button"
          className="kan-card__nav-btn"
          onClick={(e) => { e.stopPropagation(); if (canNext) onMove(task.id, 1) }}
          disabled={!canNext}
          aria-label="Siguiente"
          title={canNext ? `${t(`tareas.cols.${COLS[colIdx + 1]}`)} →` : ''}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  )
}

// ─── Column ──────────────────────────────────────────────────────────────
function KanColumn({
  col,
  items,
  subjects,
  onOpen,
  onDelete,
  onAdd,
  onMove,
  autoOpenAdd,
}: {
  col: TaskCol
  items: Task[]
  subjects: Subject[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onAdd: (col: TaskCol, title: string, subjectId: string | null) => Promise<void>
  onMove: (id: string, direction: 1 | -1) => void
  autoOpenAdd?: boolean
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col}`, data: { col } })

  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [subjectIdx, setSubjectIdx] = useState(0)

  useEffect(() => {
    if (autoOpenAdd) setAdding(true)
  }, [autoOpenAdd])

  const subjectOptions = useMemo<(Subject | null)[]>(
    () => [null, ...subjects],
    [subjects],
  )
  const selected = subjectOptions[subjectIdx % subjectOptions.length] ?? null
  const selectedInfo = selected ? subjectInfo(selected.id, subjects) : { code: '—', color: '#6b7280' }

  const submit = async () => {
    if (!title.trim()) { setAdding(false); return }
    await onAdd(col, title.trim(), selected?.id ?? null)
    setTitle('')
    setSubjectIdx(0)
  }

  return (
    <div ref={setNodeRef} className={`kan-col${isOver ? ' is-over' : ''}`}>
      <div className="kan-col__head">
        <div className="kan-col__title-wrap">
          <span className="kan-col__title">{t(`tareas.cols.${col}`)}</span>
          <span className="kan-col__count">{items.length}</span>
        </div>
        <button type="button" className="kan-col__more" aria-label="Más">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </div>

      <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {items.length === 0 && !adding && (
          <div className="kan-col__empty">{t('tareas.dropHere')}</div>
        )}
        {items.map(tk => (
          <SortableTaskCard
            key={tk.id}
            task={tk}
            subjects={subjects}
            onOpen={onOpen}
            onDelete={onDelete}
            onMove={onMove}
          />
        ))}
      </SortableContext>

      {col !== 'done' && (
        adding ? (
          <div className="quick-add">
            <input
              className="quick-add__input"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void submit() }
                else if (e.key === 'Escape') { setAdding(false); setTitle('') }
              }}
              onBlur={() => { if (!title.trim()) setAdding(false) }}
              placeholder={t('tareas.quickPlaceholder')}
            />
            <div className="quick-add__row">
              <button
                type="button"
                className="quick-add__select"
                onClick={() => setSubjectIdx((i) => (i + 1) % subjectOptions.length)}
                title="Cambiar materia"
                style={{ color: selectedInfo.color }}
              >
                {selectedInfo.code}
              </button>
              <span className="quick-add__hint">{t('tareas.quickHint')}</span>
            </div>
          </div>
        ) : (
          <button type="button" className="kan-col__add" onClick={() => setAdding(true)}>
            <span className="material-symbols-outlined">add</span>
            {t('tareas.addTask')}
          </button>
        )
      )}
    </div>
  )
}

// ─── Drawer body ─────────────────────────────────────────────────────────
function TaskDrawerBody({
  task,
  subjects,
  onUpdate,
  onDelete,
}: {
  task: Task
  subjects: Subject[]
  onUpdate: (patch: Partial<Task>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t, language } = useTranslation()
  const info = subjectInfo(task.subject_id, subjects)
  const tagClass = subjectTag(info.color)
  const col = statusToCol(task.status)
  const statusLabel =
    col === 'pending' ? t('tareas.cols.pending') :
    col === 'doing'   ? t('tareas.cols.doing') :
                        t('tareas.cols.done')

  const isDone = col === 'done'

  return (
    <div className={tagClass}>
      <div className="drawer-chips">
        <span className="subj-chip">{info.code}</span>
        <PrioBadge p={task.priority} />
      </div>

      <div className="drawer-section">
        <div className="drawer-section__label">{t('drawer.detail')}</div>
        <div className="drawer-meta">
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.status')}</span>
            <span className="drawer-meta__value">{statusLabel}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.subject')}</span>
            <span className="drawer-meta__value">{info.name || info.code}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.due')}</span>
            <span className="drawer-meta__value is-mono">{formatDue(task, language)}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.priority')}</span>
            <span className="drawer-meta__value">
              {task.priority === 'high' ? t('tareas.priority.high') :
               task.priority === 'mid' ? t('tareas.priority.mid') :
               t('tareas.priority.low')}
            </span>
          </div>
        </div>
      </div>

      <div className="drawer-actions">
        {!isDone ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onUpdate({
              status: 'done',
              is_done: true,
              done_at: new Date().toISOString(),
            })}
          >
            <span className="material-symbols-outlined">check</span>
            {t('drawer.markDone')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onUpdate({
              status: 'not_started',
              is_done: false,
              done_at: null,
            })}
          >
            <span className="material-symbols-outlined">undo</span>
            {language === 'es' ? 'Reabrir' : 'Reopen'}
          </button>
        )}
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          <span className="material-symbols-outlined">delete</span>
          {t('drawer.delete')}
        </button>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────
export default function TareasPage() {
  const { t, language } = useTranslation()
  const supabase = useMemo(() => createClient(), [])

  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drawerId, setDrawerId] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const [autoOpenPending, setAutoOpenPending] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const haptic = (ms = 12) => {
    try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(ms) } catch {}
  }

  const moveTaskCol = useCallback(async (id: string, direction: 1 | -1) => {
    const task = tasks.find(tk => tk.id === id)
    if (!task) return
    const currentCol = statusToCol(task.status)
    const idx = COLS.indexOf(currentCol)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= COLS.length) return
    const newCol = COLS[newIdx]
    const newStatus = colToStatus(newCol)
    const isDone = newCol === 'done'
    const patch: Partial<Task> = {
      status: newStatus,
      is_done: isDone,
      done_at: isDone ? new Date().toISOString() : null,
    }
    haptic(10)
    setTasks(prev => prev.map(tk => tk.id === id ? { ...tk, ...patch } : tk))
    await supabase.from('tasks').update(patch).eq('id', id)
  }, [tasks, supabase])

  // Auto-open the Pendientes quick-add when arriving via ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setAutoOpenPending(true)
      router.replace('/tareas', { scroll: false })
    }
  }, [searchParams, router])

  const fetchAll = useCallback(async () => {
    const [tk, sb, ex] = await Promise.all([
      supabase.from('tasks').select('*').order('position').order('created_at'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('exams').select('*'),
    ])
    if (tk.data) setTasks(tk.data as Task[])
    if (sb.data) setSubjects(sb.data as Subject[])
    if (ex.data) setExams(ex.data as Exam[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAll()
    const ch = supabase.channel('tareas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, fetchAll])

  // Derived
  const itemsByCol = useMemo(() => {
    const map: Record<TaskCol, Task[]> = { pending: [], doing: [], done: [] }
    for (const tk of tasks) map[statusToCol(tk.status)].push(tk)
    return map
  }, [tasks])

  const counts = {
    total: tasks.length,
    urgent: tasks.filter(tk => tk.priority === 'high' && !tk.is_done).length,
    doing: itemsByCol.doing.length,
  }
  const sub = t('tareas.subTpl')
    .replace('{n}', String(counts.total))
    .replace('{urgent}', String(counts.urgent))
    .replace('{doing}', String(counts.doing))

  const findColOfId = (id: string): TaskCol | null => {
    if (id.startsWith('col-')) return id.slice(4) as TaskCol
    const tk = tasks.find(tk => tk.id === id)
    return tk ? statusToCol(tk.status) : null
  }

  const onDragStart = (e: DragStartEvent) => { setActiveId(String(e.active.id)); haptic(15) }

  // Live cross-column move during drag — updates local status optimistically.
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const aId = String(active.id)
    const oId = String(over.id)
    if (aId === oId) return
    const aCol = findColOfId(aId)
    const oCol = findColOfId(oId)
    if (!aCol || !oCol || aCol === oCol) return
    setTasks(prev => prev.map(tk => {
      if (tk.id !== aId) return tk
      return { ...tk, status: colToStatus(oCol) }
    }))
  }

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const aId = String(active.id)
    const oId = String(over.id)

    const task = tasks.find(tk => tk.id === aId)
    if (!task) return
    const finalCol = statusToCol(task.status)

    // Reorder within same column
    if (!oId.startsWith('col-') && oId !== aId) {
      const oCol = findColOfId(oId)
      if (oCol === finalCol) {
        setTasks(prev => {
          const colItems = prev.filter(tk => statusToCol(tk.status) === finalCol)
          const others = prev.filter(tk => statusToCol(tk.status) !== finalCol)
          const oldIdx = colItems.findIndex(tk => tk.id === aId)
          const newIdx = colItems.findIndex(tk => tk.id === oId)
          if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev
          const reordered = arrayMove(colItems, oldIdx, newIdx)
          return [...others, ...reordered]
        })
      }
    }

    // Persist status if it changed
    const newStatus = colToStatus(finalCol)
    const isDone = finalCol === 'done'
    const patch: Partial<Task> = {
      status: newStatus,
      is_done: isDone,
      done_at: isDone ? new Date().toISOString() : null,
    }
    haptic(8)
    await supabase.from('tasks').update(patch).eq('id', aId)
  }

  const openCard = (id: string) => setDrawerId(id)

  const deleteCard = async (id: string) => {
    setTasks(prev => prev.filter(tk => tk.id !== id))
    if (drawerId === id) setDrawerId(null)
    await supabase.from('tasks').delete().eq('id', id)
  }

  const updateTask = async (id: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(tk => tk.id === id ? { ...tk, ...patch } : tk))
    await supabase.from('tasks').update(patch).eq('id', id)
  }

  const addCard = async (col: TaskCol, title: string, subjectId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const status = colToStatus(col)
    const isDone = col === 'done'
    const insert = {
      user_id: user.id,
      text: title,
      priority: 'mid' as const,
      due_date: null,
      subject_id: subjectId,
      is_done: isDone,
      done_at: isDone ? new Date().toISOString() : null,
      status,
      position: 0,
    }
    const { data } = await supabase.from('tasks').insert(insert).select().single()
    if (data) {
      setTasks(prev => [...prev, data as Task])
    }
  }

  const drawerTask = drawerId ? tasks.find(tk => tk.id === drawerId) ?? null : null
  const activeTask = activeId ? tasks.find(tk => tk.id === activeId) ?? null : null

  // Real DashMetaBar values
  const avg = computeWeightedAvg(subjects, exams)
  const alertDueLabel = computeAlertDueLabel(tasks, exams, language)

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">
      <DashMetaBar
        avg={avg}
        alertDueLabel={alertDueLabel}
      />

      <header className="screen-head" style={{ marginTop: 14 }}>
        <div className="screen-head__left">
          <span className="kicker">{t('tareas.eyebrow')}</span>
          <h1 className="screen-head__title">
            {t('tareas.titleA')} <span className="serif">{t('tareas.titleSerif')}</span>{' '}
            {t('tareas.titleB')}
          </h1>
          <p className="screen-head__sub">{loading ? '…' : sub}</p>
        </div>

        <div className="screen-head__actions">
          <button type="button" className="btn btn-secondary">
            <span className="material-symbols-outlined">tune</span>
            {t('tareas.filter')}
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <section className="kan-grid">
          {COLS.map(col => (
            <KanColumn
              key={col}
              col={col}
              items={itemsByCol[col]}
              subjects={subjects}
              onOpen={openCard}
              onDelete={deleteCard}
              onAdd={addCard}
              onMove={moveTaskCol}
              autoOpenAdd={col === 'pending' && autoOpenPending}
            />
          ))}
        </section>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className={`kan-card kan-card-overlay ${subjectTag(subjectInfo(activeTask.subject_id, subjects).color)}${statusToCol(activeTask.status) === 'done' ? ' is-done' : ''}`}>
              <TaskCardInner task={activeTask} subjects={subjects} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <SideDrawer
        open={!!drawerId}
        onClose={() => setDrawerId(null)}
        kicker={t('drawer.detail')}
        title={drawerTask ? drawerTask.text : ''}
      >
        {drawerTask && (
          <TaskDrawerBody
            task={drawerTask}
            subjects={subjects}
            onUpdate={(patch) => updateTask(drawerTask.id, patch)}
            onDelete={() => deleteCard(drawerTask.id)}
          />
        )}
      </SideDrawer>
    </div>
  )
}
