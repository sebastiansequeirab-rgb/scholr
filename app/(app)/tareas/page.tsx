'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
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
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { useTranslation } from '@/hooks/useTranslation'
import { subjectTag } from '@/lib/utils'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'
import { SideDrawer } from '@/components/ui/SideDrawer'
import { MOCK_TASKS, type MockTask, type TaskCol, type TaskPriority } from '@/features/tareas/data/mocks'

const COLS: TaskCol[] = ['pending', 'doing', 'done']

const SUBJECT_PALETTE = [
  { code: 'INST', color: '#a78bfa' },
  { code: 'MATE', color: '#34d399' },
  { code: 'CALC', color: '#fbbf24' },
  { code: 'TEC',  color: '#22d3ee' },
  { code: 'PROG', color: '#60a5fa' },
  { code: 'TRAD', color: '#fb7185' },
] as const

function PrioBadge({ p }: { p: TaskPriority | null }) {
  const { t } = useTranslation()
  if (!p) return null
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

function TaskCardInner({ task }: { task: MockTask }) {
  const isDone = task.col === 'done'
  return (
    <>
      <div className="kan-card__head">
        <span className="subj-chip">{task.subjectCode}</span>
        {task.grade && <span className="grade-chip">{task.grade}</span>}
        <PrioBadge p={task.priority} />
      </div>

      <div className="kan-card__title">{task.title}</div>
      {task.description && <div className="kan-card__desc">{task.description}</div>}

      {task.col === 'doing' && task.progress != null && (
        <div className="kan-card__progress" aria-hidden>
          <div className="kan-card__progress-fill" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      <div className="kan-card__foot">
        <span className="material-symbols-outlined">schedule</span>
        <span>{task.due}</span>
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
  onOpen,
  onDelete,
}: {
  task: MockTask
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { col: task.col },
  })

  const tagClass = subjectTag(task.subjectColor)
  const isDone = task.col === 'done'
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
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isDragging) {
          e.preventDefault()
          onOpen(task.id)
        }
      }}
      className={`kan-card ${tagClass}${isDone ? ' is-done' : ''}${isDragging ? ' is-dragging' : ''}`}
    >
      <button
        type="button"
        className="kan-card__delete"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
        aria-label={t('tareas.deleteAria')}
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      <TaskCardInner task={task} />
    </div>
  )
}

function KanColumn({
  col,
  items,
  onOpen,
  onDelete,
  onAdd,
}: {
  col: TaskCol
  items: MockTask[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onAdd: (col: TaskCol, title: string, subjectIdx: number) => void
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col}`, data: { col } })

  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [subjectIdx, setSubjectIdx] = useState(0)

  const submit = () => {
    if (!title.trim()) { setAdding(false); return }
    onAdd(col, title.trim(), subjectIdx)
    setTitle('')
    setSubjectIdx(0)
  }

  return (
    <div
      ref={setNodeRef}
      className={`kan-col${isOver ? ' is-over' : ''}`}
    >
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
          <SortableTaskCard key={tk.id} task={tk} onOpen={onOpen} onDelete={onDelete} />
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
                if (e.key === 'Enter') { e.preventDefault(); submit() }
                else if (e.key === 'Escape') { setAdding(false); setTitle('') }
              }}
              placeholder={t('tareas.quickPlaceholder')}
            />
            <div className="quick-add__row">
              <button
                type="button"
                className="quick-add__select"
                onClick={() => setSubjectIdx((i) => (i + 1) % SUBJECT_PALETTE.length)}
                title="Cambiar materia"
              >
                {SUBJECT_PALETTE[subjectIdx].code}
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

function TaskDrawerBody({ task }: { task: MockTask }) {
  const { t } = useTranslation()
  const tagClass = subjectTag(task.subjectColor)
  const statusLabel =
    task.col === 'pending' ? t('tareas.cols.pending') :
    task.col === 'doing'   ? t('tareas.cols.doing') :
                              t('tareas.cols.done')
  return (
    <div className={tagClass}>
      <div className="drawer-chips">
        <span className="subj-chip">{task.subjectCode}</span>
        {task.priority && <PrioBadge p={task.priority} />}
        {task.grade && <span className="grade-chip">{task.grade}</span>}
      </div>

      {task.description && (
        <p className="side-drawer__placeholder" style={{ marginBottom: 4 }}>
          {task.description}
        </p>
      )}

      <div className="drawer-section">
        <div className="drawer-section__label">{t('drawer.detail')}</div>
        <div className="drawer-meta">
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.status')}</span>
            <span className="drawer-meta__value">{statusLabel}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.subject')}</span>
            <span className="drawer-meta__value is-mono">{task.subjectCode}</span>
          </div>
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.due')}</span>
            <span className="drawer-meta__value is-mono">{task.due}</span>
          </div>
          {task.col === 'doing' && task.progress != null && (
            <div className="drawer-meta__row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="drawer-progress-row">
                <span className="drawer-meta__label">{t('drawer.progress')}</span>
                <span>{task.progress}%</span>
              </div>
              <div className="drawer-progress" aria-hidden>
                <div className="drawer-progress__fill" style={{ width: `${task.progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="drawer-actions">
        {task.col !== 'done' && (
          <button type="button" className="btn btn-primary">
            <span className="material-symbols-outlined">check</span>
            {t('drawer.markDone')}
          </button>
        )}
        <button type="button" className="btn btn-secondary">
          <span className="material-symbols-outlined">edit</span>
          {t('drawer.edit')}
        </button>
      </div>
    </div>
  )
}

export default function TareasPage() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<MockTask[]>(MOCK_TASKS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drawerId, setDrawerId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const itemsByCol = useMemo(() => {
    const map: Record<TaskCol, MockTask[]> = { pending: [], doing: [], done: [] }
    for (const tk of tasks) map[tk.col].push(tk)
    return map
  }, [tasks])

  const counts = {
    total: tasks.length,
    urgent: tasks.filter(tk => tk.priority === 'high' && tk.col !== 'done').length,
    doing: itemsByCol.doing.length,
  }
  const sub = t('tareas.subTpl')
    .replace('{n}', String(counts.total))
    .replace('{urgent}', String(counts.urgent))
    .replace('{doing}', String(counts.doing))

  const findColOfId = (id: string): TaskCol | null => {
    if (id.startsWith('col-')) return id.slice(4) as TaskCol
    const t = tasks.find(t => t.id === id)
    return t ? t.col : null
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    if (activeIdStr === overIdStr) return

    const activeCol = findColOfId(activeIdStr)
    const overCol = findColOfId(overIdStr)
    if (!activeCol || !overCol || activeCol === overCol) return

    setTasks(prev => prev.map(tk => {
      if (tk.id !== activeIdStr) return tk
      const next: MockTask = { ...tk, col: overCol }
      // Adjust default fields when moving between columns
      if (overCol === 'doing' && next.progress == null) next.progress = 0
      if (overCol !== 'doing') delete (next as Partial<MockTask>).progress
      if (overCol === 'done') {
        next.due = t('tareas.due.now')
      }
      return next
    }))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    if (activeIdStr === overIdStr) return

    const activeCol = findColOfId(activeIdStr)
    if (!activeCol) return

    // Reorder within same column when dropped on another card
    if (!overIdStr.startsWith('col-')) {
      const overCol = findColOfId(overIdStr)
      if (overCol === activeCol) {
        setTasks(prev => {
          const colItems = prev.filter(tk => tk.col === activeCol)
          const others = prev.filter(tk => tk.col !== activeCol)
          const oldIdx = colItems.findIndex(tk => tk.id === activeIdStr)
          const newIdx = colItems.findIndex(tk => tk.id === overIdStr)
          if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev
          const reordered = arrayMove(colItems, oldIdx, newIdx)
          return [...others, ...reordered]
        })
      }
    }
  }

  const openCard = (id: string) => setDrawerId(id)
  const deleteCard = (id: string) => setTasks(prev => prev.filter(tk => tk.id !== id))

  const addCard = (col: TaskCol, title: string, subjectIdx: number) => {
    const sub = SUBJECT_PALETTE[subjectIdx]
    const newTask: MockTask = {
      id: `t-new-${Date.now()}`,
      col,
      subjectCode: sub.code,
      subjectColor: sub.color,
      priority: 'mid',
      title,
      due: col === 'doing' ? t('tareas.due.now') : t('tareas.due.today'),
      ...(col === 'doing' ? { progress: 0 } : {}),
    }
    setTasks(prev => [...prev, newTask])
  }

  const drawerTask = drawerId ? tasks.find(tk => tk.id === drawerId) ?? null : null
  const activeTask = activeId ? tasks.find(tk => tk.id === activeId) ?? null : null

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">
      <DashMetaBar
        weekIndex={17}
        weekTotal={20}
        avg={13.6}
        alertDueLabel="1 entrega cierra en 4h 34m"
      />

      <header className="screen-head" style={{ marginTop: 14 }}>
        <div className="screen-head__left">
          <span className="kicker">{t('tareas.eyebrow')}</span>
          <h1 className="screen-head__title">
            {t('tareas.titleA')} <span className="serif">{t('tareas.titleSerif')}</span>{' '}
            {t('tareas.titleB')}
          </h1>
          <p className="screen-head__sub">{sub}</p>
        </div>

        <div className="screen-head__actions">
          <button type="button" className="btn btn-secondary">
            <span className="material-symbols-outlined">tune</span>
            {t('tareas.filter')}
          </button>
          <button type="button" className="btn-new">
            <span className="material-symbols-outlined">add</span>
            {t('tareas.newTask')}
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
              onOpen={openCard}
              onDelete={deleteCard}
              onAdd={addCard}
            />
          ))}
        </section>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className={`kan-card kan-card-overlay ${subjectTag(activeTask.subjectColor)}${activeTask.col === 'done' ? ' is-done' : ''}`}>
              <TaskCardInner task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <SideDrawer
        open={!!drawerId}
        onClose={() => setDrawerId(null)}
        kicker={t('drawer.detail')}
        title={drawerTask ? drawerTask.title : ''}
      >
        {drawerTask && <TaskDrawerBody task={drawerTask} />}
      </SideDrawer>
    </div>
  )
}
