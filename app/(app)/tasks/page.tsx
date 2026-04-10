'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { isToday, isTomorrow, daysUntil } from '@/lib/utils'
import { TaskNotes } from '@/components/tasks/TaskNotes'
import type { Task, Subtask, Subject } from '@/types'

type Filter = 'all' | 'not_started' | 'in_progress' | 'completed' | 'urgent'

// Status config
const STATUS_CONFIG = {
  not_started: { label: 'Sin empezar', icon: 'radio_button_unchecked', color: 'var(--color-outline)',  bg: 'transparent' },
  in_progress: { label: 'En progreso', icon: 'pending',                color: 'var(--warning)',        bg: 'var(--priority-mid-bg)' },
  done:        { label: 'Completado',  icon: 'check_circle',           color: 'var(--success)',        bg: 'color-mix(in srgb, var(--success) 12%, transparent)' },
} as const

function TaskItem({
  task,
  subjects,
  onDelete,
  onRefresh,
}: {
  task: Task
  subjects: Subject[]
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const [expanded,       setExpanded]       = useState(false)
  const [notesOpen,      setNotesOpen]      = useState(false)
  const [subtasks,       setSubtasks]       = useState<Subtask[]>([])
  const [subtaskText,    setSubtaskText]    = useState('')
  const [subtasksLoaded, setSubtasksLoaded] = useState(false)
  const [taskStatus,     setTaskStatus]     = useState<Task['status']>(task.status || 'not_started')

  const subject = subjects.find(s => s.id === task.subject_id)
  const supabase = createClient()

  const loadSubtasks = useCallback(async () => {
    if (subtasksLoaded) return
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', task.id).order('position')
    setSubtasks(data || [])
    setSubtasksLoaded(true)
  }, [task.id, subtasksLoaded, supabase])

  const handleExpand = () => {
    setExpanded(!expanded)
    if (!expanded) loadSubtasks()
  }

  // Cycle: not_started → in_progress → done → not_started
  const cycleStatus = async () => {
    const next: Task['status'] = taskStatus === 'not_started' ? 'in_progress'
      : taskStatus === 'in_progress' ? 'done' : 'not_started'
    setTaskStatus(next)
    const isDone = next === 'done'
    await supabase.from('tasks').update({
      status: next,
      is_done: isDone,
      done_at: isDone ? new Date().toISOString() : null,
    }).eq('id', task.id)
    onRefresh()
  }

  const toggleSubtask = async (st: Subtask) => {
    await supabase.from('subtasks').update({ is_done: !st.is_done }).eq('id', st.id)
    setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, is_done: !s.is_done } : s))
    onRefresh()
  }

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subtaskText.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('subtasks').insert({
      user_id: user.id,
      task_id: task.id,
      text: subtaskText.trim(),
      is_done: false,
      position: subtasks.length,
    }).select().single()
    if (data) setSubtasks(prev => [...prev, data])
    setSubtaskText('')
    onRefresh()
  }

  const deleteSubtask = async (id: string) => {
    await supabase.from('subtasks').delete().eq('id', id)
    setSubtasks(prev => prev.filter(s => s.id !== id))
    onRefresh()
  }

  const statusCfg = STATUS_CONFIG[taskStatus]
  const isDone = taskStatus === 'done'

  const dueBadge = () => {
    if (!task.due_date) return null
    const days = daysUntil(task.due_date)
    if (isToday(task.due_date))    return { label: t('exams.today'),    color: 'var(--danger)',  bg: 'var(--priority-high-bg)' }
    if (isTomorrow(task.due_date)) return { label: t('exams.tomorrow'), color: 'var(--warning)', bg: 'var(--priority-mid-bg)'  }
    if (days <= 7)                 return { label: `${days}d`,          color: 'var(--warning)', bg: 'var(--priority-mid-bg)'  }
    return                                { label: `${days}d`,          color: 'var(--color-primary)', bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }
  }
  const badge = dueBadge()

  return (
    <div
      className={`rounded-2xl p-5 mb-2 transition-all duration-200 group ${isDone ? 'opacity-50' : 'hover:brightness-105'}`}
      style={{
        backgroundColor: 'var(--s-low)',
        border: taskStatus === 'in_progress'
          ? '1px solid color-mix(in srgb, var(--warning) 30%, transparent)'
          : '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-4">
        {/* Status cycle button */}
        <button
          onClick={cycleStatus}
          title={statusCfg.label}
          className="w-6 h-6 flex-shrink-0 mt-0.5 transition-all duration-200 flex items-center justify-center hover:scale-110 rounded-full"
          style={{ color: statusCfg.color }}
          aria-label={`Estado: ${statusCfg.label}`}
        >
          <span className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: taskStatus === 'done' ? "'FILL' 1" : "'FILL' 0" }}>
            {statusCfg.icon}
          </span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold ${isDone ? 'line-through' : ''}`}
              style={{ color: isDone ? 'var(--color-outline)' : 'var(--on-surface)' }}>
              {task.text}
            </span>

            {/* Status pill — only show in_progress */}
            {taskStatus === 'in_progress' && (
              <span className="mono text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"
                style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--warning)' }} />
                En progreso
              </span>
            )}

            {badge && (
              <span className="mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                style={{ backgroundColor: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            )}

            {subject && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${subject.color}18`, color: subject.color }}>
                {subject.name}
              </span>
            )}

            {subtasksLoaded && subtasks.length > 0 && (
              <button
                onClick={handleExpand}
                className="mono text-[9px] px-1.5 py-0.5 rounded border transition-colors hover:brightness-110"
                style={{ borderColor: 'var(--border-default)', color: 'var(--color-outline)' }}
              >
                {subtasks.filter(s => s.is_done).length}/{subtasks.length}
              </button>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-3 mt-1.5">
            <button onClick={handleExpand} className="mono text-[10px] flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined text-[12px]">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
              {t('tasks.subtasks')}
            </button>

            <button
              onClick={() => setNotesOpen(!notesOpen)}
              className="mono text-[10px] flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: notesOpen ? 'var(--color-primary)' : 'var(--color-outline)' }}
            >
              {task.notes && task.notes.length > 7 && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} />
              )}
              <span className="material-symbols-outlined text-[12px]">edit_note</span>
              {t('tasks.taskNotes') || 'Notas'}
            </button>
          </div>

          {expanded && (
            <div className="mt-3 space-y-2 animate-slide-up">
              {subtasks.map(st => (
                <div key={st.id} className="flex items-center gap-3 group/sub">
                  <button onClick={() => toggleSubtask(st)}
                    className="w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all"
                    style={{
                      borderColor: st.is_done ? 'var(--color-primary)' : 'var(--border-strong)',
                      backgroundColor: st.is_done ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                    }}>
                    {st.is_done && <span className="material-symbols-outlined text-[10px]" style={{ color: 'var(--color-primary)' }}>check</span>}
                  </button>
                  <span className={`text-xs flex-1 ${st.is_done ? 'line-through' : ''}`}
                    style={{ color: st.is_done ? 'var(--color-outline)' : 'var(--on-surface-variant)' }}>
                    {st.text}
                  </span>
                  <button onClick={() => deleteSubtask(st.id)}
                    className="opacity-0 group-hover/sub:opacity-100 text-red-400 transition-opacity" aria-label="Delete subtask">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
              <form onSubmit={addSubtask} className="flex gap-2 mt-2">
                <input
                  value={subtaskText}
                  onChange={(e) => setSubtaskText(e.target.value)}
                  placeholder={t('tasks.addSubtask')}
                  className="input text-xs py-1.5 flex-1"
                />
                <button type="submit" className="btn-secondary text-xs px-3 py-1.5">+</button>
              </form>
            </div>
          )}

          {notesOpen && (
            <TaskNotes task={task} onSaved={onRefresh} />
          )}
        </div>

        {/* Delete */}
        <button onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-400/10"
          style={{ color: 'var(--danger)' }}
          aria-label="Delete task">
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { t } = useTranslation()
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [filter,        setFilter]        = useState<Filter>('all')
  const [activeSubject, setActiveSubject] = useState<string>('all')
  const [loading,       setLoading]       = useState(true)

  const [text,         setText]         = useState('')
  const [priority,     setPriority]     = useState<'high' | 'mid' | 'low'>('mid')
  const [dueDate,      setDueDate]      = useState('')
  const [subjectId,    setSubjectId]    = useState<string>('')

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: ts }, { data: ss }] = await Promise.all([
      supabase.from('tasks').select('*').order('position').order('created_at'),
      supabase.from('subjects').select('*').order('name'),
    ])
    setTasks(ts || [])
    setSubjects(ss || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const supabase = createClient()
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },    () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tasks').insert({
      user_id: user.id, text: text.trim(), priority,
      due_date: dueDate || null, subject_id: subjectId || null,
      is_done: false, position: tasks.length,
    })
    setText(''); setDueDate(''); setSubjectId('')
    fetchData()
  }

  const deleteTask = async (id: string) => {
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', id)
    fetchData()
  }

  // Tasks after subject filter (before status filter) — for counts
  const subjectFiltered = tasks.filter(t =>
    activeSubject === 'all' || t.subject_id === activeSubject
  )

  const filterCounts: Record<Filter, number> = {
    all:         subjectFiltered.length,
    not_started: subjectFiltered.filter(t => !t.is_done && (t.status || 'not_started') === 'not_started').length,
    in_progress: subjectFiltered.filter(t => !t.is_done && t.status === 'in_progress').length,
    completed:   subjectFiltered.filter(t => t.is_done).length,
    urgent:      subjectFiltered.filter(t => !t.is_done && !!t.due_date && daysUntil(t.due_date) <= 1).length,
  }

  const filteredTasks = subjectFiltered.filter(t => {
    if (filter === 'not_started') return !t.is_done && (t.status || 'not_started') === 'not_started'
    if (filter === 'in_progress') return !t.is_done && t.status === 'in_progress'
    if (filter === 'completed')   return t.is_done
    if (filter === 'urgent')      return !t.is_done && t.due_date && daysUntil(t.due_date) <= 1
    return true
  })

  const pending   = filteredTasks.filter(t => !t.is_done)
  const completed = filteredTasks.filter(t => t.is_done)
  const totalPending = tasks.filter(t => !t.is_done).length
  const totalTasks   = tasks.length
  const progress     = totalTasks > 0 ? Math.round(((totalTasks - totalPending) / totalTasks) * 100) : 0
  const allDone      = totalTasks > 0 && totalPending === 0

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',         label: t('tasks.all')         },
    { key: 'not_started', label: t('tasks.not_started') },
    { key: 'in_progress', label: t('tasks.in_progress') },
    { key: 'completed',   label: t('tasks.completed')   },
    { key: 'urgent',      label: t('tasks.urgent')      },
  ]

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
          {t('tasks.title')}
        </h1>
        <div className="mt-4">
          <div className="flex justify-between mono text-[10px] mb-1.5" style={{ color: 'var(--color-outline)' }}>
            <span>{t('tasks.progress')}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* All done */}
      {allDone && (
        <div className="rounded-2xl text-center py-8 mb-6 animate-bounce-once"
          style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
          <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
            celebration
          </span>
          <h2 className="font-bold" style={{ color: 'var(--on-surface)' }}>{t('tasks.allDone')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-outline)' }}>{t('tasks.allDoneDesc')}</p>
        </div>
      )}

      {/* Add task */}
      <form onSubmit={addTask} className="rounded-2xl p-5 mb-6"
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <div className="relative flex gap-3">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-xl"
            style={{ color: 'var(--color-outline)' }}>add_circle</span>
          <input
            id="new-task-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('tasks.placeholder')}
            className="input flex-1 pl-12"
            aria-label={t('tasks.add')}
          />
          <button type="submit" className="btn-primary px-5">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <select value={priority} onChange={(e) => setPriority(e.target.value as 'high' | 'mid' | 'low')}
            className="input w-auto text-xs py-1.5" aria-label={t('tasks.priority')}>
            <option value="high">● {t('tasks.high')}</option>
            <option value="mid">● {t('tasks.mid')}</option>
            <option value="low">● {t('tasks.low')}</option>
          </select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
            className="input w-auto text-xs py-1.5" aria-label={t('tasks.subject')}>
            <option value="">{t('tasks.noSubject')}</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-1.5 input w-auto py-0 pr-2" style={{ backgroundColor: 'var(--s-base)' }}>
            <span className="material-symbols-outlined text-[14px] flex-shrink-0" style={{ color: dueDate ? 'var(--color-primary)' : 'var(--color-outline)' }}>event</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent outline-none text-xs py-1.5 w-[120px]"
              style={{ color: dueDate ? 'var(--on-surface)' : 'var(--color-outline)' }}
              aria-label={t('tasks.dueDate')} />
          </div>
        </div>
      </form>

      {/* Subject chips */}
      {subjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setActiveSubject('all')}
            className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border"
            style={{
              backgroundColor: activeSubject === 'all' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
              color:           activeSubject === 'all' ? 'var(--color-primary)' : 'var(--color-outline)',
              borderColor:     activeSubject === 'all' ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-default)',
            }}>
            {t('tasks.all')}
          </button>
          {subjects.map(s => (
            <button key={s.id}
              onClick={() => setActiveSubject(s.id)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border"
              style={{
                backgroundColor: activeSubject === s.id ? `${s.color}20` : 'transparent',
                color:           s.color,
                borderColor:     activeSubject === s.id ? `${s.color}40` : 'var(--border-default)',
              }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs with counts — scrollable on mobile */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto scrollbar-hide" style={{ backgroundColor: 'var(--s-base)' }}>
        {FILTERS.map(({ key, label }) => {
          const isActive = filter === key
          return (
            <button key={key} onClick={() => setFilter(key)}
              className="flex-shrink-0 text-xs py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
              style={{
                backgroundColor: isActive ? 'var(--s-high)' : 'transparent',
                color:           isActive ? 'var(--on-surface)' : 'var(--color-outline)',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              }}>
              {label}
              {filterCounts[key] > 0 && (
                <span className="mono text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--s-highest, var(--s-high))',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-outline)',
                  }}>
                  {filterCounts[key]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-16" />)}
        </div>
      )}

      {!loading && (
        <>
          {filter !== 'completed' && (
            <section>
              <h2 className="mono text-[10px] uppercase tracking-widest mb-3"
                style={{ color: 'var(--color-outline)' }}>
                {filter === 'not_started' ? t('tasks.not_started')
                  : filter === 'in_progress' ? t('tasks.in_progress')
                  : t('tasks.pending_section')} ({pending.length})
              </h2>
              {pending.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--color-outline)' }}>
                  {t('tasks.noTasks')} ✓
                </p>
              )}
              {pending.map(task => (
                <TaskItem key={task.id} task={task} subjects={subjects}
                  onDelete={deleteTask} onRefresh={fetchData} />
              ))}
            </section>
          )}

          {filter !== 'not_started' && filter !== 'in_progress' && filter !== 'urgent' && completed.length > 0 && (
            <details className="mt-5">
              <summary className="mono text-[10px] uppercase tracking-widest cursor-pointer mb-3 flex items-center gap-2"
                style={{ color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined text-[14px]">history</span>
                {t('tasks.completed_section')} ({completed.length})
              </summary>
              <div className="mt-2">
                {completed.map(task => (
                  <TaskItem key={task.id} task={task} subjects={subjects}
                    onDelete={deleteTask} onRefresh={fetchData} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
