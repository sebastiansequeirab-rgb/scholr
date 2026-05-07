'use client'

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { subjectTag } from '@/lib/utils'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'
import { SideDrawer } from '@/components/ui/SideDrawer'
import { MOCK_TASKS, type MockTask, type TaskCol } from '@/features/tareas/data/mocks'

const COLS: { id: TaskCol; iconColor: string }[] = [
  { id: 'pending', iconColor: 'var(--warning)' },
  { id: 'doing',   iconColor: 'var(--info)' },
  { id: 'done',    iconColor: 'var(--success)' },
]

function PrioBadge({ p }: { p: MockTask['priority'] }) {
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

function TaskCard({ task, onOpen }: { task: MockTask; onOpen: (id: string) => void }) {
  const tagClass = subjectTag(task.subjectColor)
  const isDone = task.col === 'done'
  return (
    <button
      type="button"
      className={`kan-card ${tagClass}${isDone ? ' is-done' : ''}`}
      onClick={() => onOpen(task.id)}
    >
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
    </button>
  )
}

export default function TareasPage() {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [drawerId, setDrawerId] = useState<string | null>(null)

  const byCol = (col: TaskCol) => MOCK_TASKS.filter(tk => tk.col === col)
  const counts = {
    pending: byCol('pending').length,
    doing:   byCol('doing').length,
    done:    byCol('done').length,
    total:   MOCK_TASKS.length,
    urgent:  MOCK_TASKS.filter(tk => tk.priority === 'high' && tk.col !== 'done').length,
  }

  const sub = t('tareas.subTpl')
    .replace('{n}', String(counts.total))
    .replace('{urgent}', String(counts.urgent))
    .replace('{doing}', String(counts.doing))

  const openCard = (id: string) => {
    // eslint-disable-next-line no-console
    console.log('[tareas] open', id)
    setDrawerId(id)
  }

  const drawerTask = drawerId ? MOCK_TASKS.find(t => t.id === drawerId) : null

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
          <div className="seg" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'kanban'}
              className={`seg__btn${viewMode === 'kanban' ? ' is-active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              {t('tareas.viewKanban')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              className={`seg__btn${viewMode === 'list' ? ' is-active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              {t('tareas.viewList')}
            </button>
          </div>
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

      <section className="kan-grid">
        {COLS.map(({ id }) => {
          const items = byCol(id)
          return (
            <div key={id} className="kan-col">
              <div className="kan-col__head">
                <div className="kan-col__title-wrap">
                  <span className="kan-col__title">{t(`tareas.cols.${id}`)}</span>
                  <span className="kan-col__count">{items.length}</span>
                </div>
                <button type="button" className="kan-col__more" aria-label="Más">
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>

              {items.map(tk => (
                <TaskCard key={tk.id} task={tk} onOpen={openCard} />
              ))}

              {id !== 'done' && (
                <button type="button" className="kan-col__add">
                  <span className="material-symbols-outlined">add</span>
                  {t('tareas.addTask')}
                </button>
              )}
            </div>
          )
        })}
      </section>

      <button type="button" className="fab-new" aria-label={t('tareas.newTask')}>
        <span className="material-symbols-outlined">add</span>
      </button>

      <SideDrawer
        open={!!drawerId}
        onClose={() => setDrawerId(null)}
        kicker={t('drawer.detail')}
        title={drawerTask?.title || ''}
      >
        <p className="side-drawer__placeholder">
          {t('drawer.placeholder').replace('{id}', drawerId || '')}
        </p>
        {drawerTask && (
          <span className="side-drawer__id">{drawerTask.subjectCode} · {drawerTask.due}</span>
        )}
      </SideDrawer>
    </div>
  )
}
