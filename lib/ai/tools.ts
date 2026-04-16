// ─── Tool definitions + handlers ─────────────────────────────────────────────
// Each tool: an OpenAI-compatible function definition + an execute() that queries Supabase.
// The model never touches the DB directly — it only calls these.

import { createClient } from '@supabase/supabase-js'
import type { ToolDefinition } from './provider'
import type { ToolResult } from './types'

// Build an authenticated Supabase client from the user's JWT
function supabaseAs(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// ─── Function declarations (sent to Groq) ────────────────────────────────────

export const TOOL_DECLARATIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_subjects',
      description: 'Get the list of subjects/courses the student is enrolled in.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_today_schedule',
      description: 'Get the class schedule for today.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_exams',
      description: 'Get upcoming exams and academic activities.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_week_tasks',
      description: 'Get pending tasks for this week.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notes_by_subject',
      description: 'Get notes for a specific subject.',
      parameters: {
        type: 'object',
        properties: {
          subject_id: { type: 'string', description: 'UUID of the subject' },
        },
        required: ['subject_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_subject_progress',
      description: 'Get academic progress (grades, weights) for a subject.',
      parameters: {
        type: 'object',
        properties: {
          subject_id: { type: 'string', description: 'UUID of the subject' },
        },
        required: ['subject_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new pending task for the student.',
      parameters: {
        type: 'object',
        properties: {
          title:      { type: 'string', description: 'Task title' },
          due_date:   { type: 'string', description: 'Due date YYYY-MM-DD (optional)' },
          priority:   { type: 'string', description: 'high | mid | low (default: mid)' },
          subject_id: { type: 'string', description: 'UUID of related subject (optional)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_subject_evaluations',
      description: 'Get all evaluations for a specific subject with their submission status, dates and weights.',
      parameters: {
        type: 'object',
        properties: {
          subject_id: { type: 'string', description: 'UUID of the subject' },
        },
        required: ['subject_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_all_subjects_summary',
      description: 'Get a summary of all subjects: credits, grade progress, and next upcoming evaluation.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_exam',
      description: 'Create a new exam or academic activity.',
      parameters: {
        type: 'object',
        properties: {
          title:         { type: 'string', description: 'Title of the activity' },
          exam_date:     { type: 'string', description: 'Date YYYY-MM-DD' },
          activity_type: { type: 'string', description: 'exam | workshop | activity | task | study_session' },
          subject_id:    { type: 'string', description: 'UUID of related subject (optional)' },
          percentage:    { type: 'number', description: 'Weight % of final grade (optional)' },
          exam_time:     { type: 'string', description: 'Time HH:MM (optional)' },
          location:      { type: 'string', description: 'Room or location (optional)' },
        },
        required: ['title', 'exam_date', 'activity_type'],
      },
    },
  },
]

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  accessToken: string,
  userId: string,
): Promise<ToolResult> {
  const db = supabaseAs(accessToken)

  try {
    switch (name) {

      case 'get_subjects': {
        const { data, error } = await db
          .from('subjects')
          .select('id, name, professor, color, icon')
          .eq('user_id', userId)
          .order('name')
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: data ?? [] }
      }

      case 'get_today_schedule': {
        const dow = new Date().getDay() // 0=Sun…6=Sat
        const { data: schedules, error } = await db
          .from('schedules')
          .select('start_time, end_time, room, subjects(name, color)')
          .eq('user_id', userId)
          .eq('day_of_week', dow)
          .order('start_time')
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: schedules ?? [] }
      }

      case 'get_upcoming_exams': {
        const limit = typeof args.limit === 'number' ? Math.min(args.limit, 10) : 5
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await db
          .from('exams')
          .select('id, title, exam_date, exam_time, activity_type, percentage, location, subjects(name)')
          .eq('user_id', userId)
          .gte('exam_date', today)
          .order('exam_date')
          .limit(limit)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: data ?? [] }
      }

      case 'get_week_tasks': {
        const today = new Date()
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() + 7)
        const { data, error } = await db
          .from('tasks')
          .select('id, text, priority, status, due_date, subjects(name)')
          .eq('user_id', userId)
          .neq('status', 'done')
          .or(`due_date.is.null,due_date.lte.${weekEnd.toISOString().split('T')[0]}`)
          .order('due_date', { nullsFirst: false })
          .limit(15)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: data ?? [] }
      }

      case 'get_notes_by_subject': {
        const subjectId = String(args.subject_id ?? '')
        if (!subjectId) return { ok: false, error: 'subject_id required' }
        const { data, error } = await db
          .from('notes')
          .select('id, title, updated_at')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .order('updated_at', { ascending: false })
          .limit(10)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: data ?? [] }
      }

      case 'get_subject_progress': {
        const subjectId = String(args.subject_id ?? '')
        if (!subjectId) return { ok: false, error: 'subject_id required' }
        const { data, error } = await db
          .from('exams')
          .select('title, activity_type, percentage, grade, exam_date')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .neq('activity_type', 'study_session')
          .order('exam_date')
        if (error) return { ok: false, error: error.message }
        const exams = data ?? []
        const earned  = exams.filter(e => e.grade != null).reduce((s, e) => s + (e.grade * e.percentage / 100), 0)
        const pending = exams.filter(e => e.grade == null).reduce((s, e) => s + (20 * e.percentage / 100), 0)
        return { ok: true, data: { exams, earned: +earned.toFixed(2), max_possible: +(earned + pending).toFixed(2) } }
      }

      case 'create_task': {
        const title = String(args.title ?? '').trim()
        if (!title) return { ok: false, error: 'title is required' }
        const priority = (['high', 'mid', 'low'] as const).includes(args.priority as 'high') ? args.priority as 'high' | 'mid' | 'low' : 'mid'
        const due_date = typeof args.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.due_date) ? args.due_date : null
        const subject_id = typeof args.subject_id === 'string' ? args.subject_id : null

        const { data, error } = await db
          .from('tasks')
          .insert({ user_id: userId, text: title, priority, due_date, subject_id, status: 'not_started', is_done: false, position: 0 })
          .select('id, text, priority, due_date')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'create_exam': {
        const title = String(args.title ?? '').trim()
        const exam_date = String(args.exam_date ?? '')
        const activity_type = String(args.activity_type ?? 'exam')
        if (!title || !exam_date) return { ok: false, error: 'title and exam_date are required' }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(exam_date)) return { ok: false, error: 'exam_date must be YYYY-MM-DD' }
        const validTypes = ['exam', 'workshop', 'activity', 'task', 'study_session']
        if (!validTypes.includes(activity_type)) return { ok: false, error: `activity_type must be one of: ${validTypes.join(', ')}` }

        const { data, error } = await db
          .from('exams')
          .insert({
            user_id: userId,
            title,
            exam_date,
            activity_type,
            subject_id:  typeof args.subject_id === 'string' ? args.subject_id : null,
            percentage:  typeof args.percentage === 'number' ? args.percentage : null,
            exam_time:   typeof args.exam_time === 'string'  ? args.exam_time  : null,
            location:    typeof args.location === 'string'   ? args.location   : null,
          })
          .select('id, title, exam_date, activity_type')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'get_subject_evaluations': {
        const subjectId = String(args.subject_id ?? '')
        if (!subjectId) return { ok: false, error: 'subject_id required' }
        const { data, error } = await db
          .from('exams')
          .select('id, title, activity_type, exam_date, exam_time, percentage, grade, submission_status, submitted_at, graded_at, location, notes')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .neq('activity_type', 'study_session')
          .order('exam_date')
        if (error) return { ok: false, error: error.message }
        const exams = data ?? []
        const earned   = exams.filter(e => e.grade != null && e.percentage != null).reduce((s, e) => s + (e.grade * e.percentage / 100), 0)
        const possible = exams.filter(e => e.grade == null && e.percentage != null).reduce((s, e) => s + (20 * e.percentage / 100), 0)
        return { ok: true, data: { evaluations: exams, earned: +earned.toFixed(2), max_possible: +(earned + possible).toFixed(2) } }
      }

      case 'get_all_subjects_summary': {
        const today = new Date().toISOString().split('T')[0]
        const [subjectsRes, examsRes] = await Promise.all([
          db.from('subjects').select('id, name, professor, color, credits').eq('user_id', userId).order('name'),
          db.from('exams').select('subject_id, title, exam_date, percentage, grade, activity_type').eq('user_id', userId).neq('activity_type', 'study_session').order('exam_date'),
        ])
        if (subjectsRes.error) return { ok: false, error: subjectsRes.error.message }
        const subjects = subjectsRes.data ?? []
        const allExams = examsRes.data ?? []
        const summary = subjects.map(s => {
          const evals = allExams.filter(e => e.subject_id === s.id)
          const graded = evals.filter(e => e.grade != null && e.percentage != null)
          const earned = graded.reduce((sum, e) => sum + (e.grade * e.percentage / 100), 0)
          const nextEval = evals.find(e => e.exam_date >= today)
          return {
            id: s.id,
            name: s.name,
            professor: s.professor,
            credits: s.credits,
            earned: +earned.toFixed(2),
            graded_count: graded.length,
            total_evals: evals.length,
            next_eval: nextEval ? { title: nextEval.title, date: nextEval.exam_date, type: nextEval.activity_type } : null,
          }
        })
        return { ok: true, data: summary }
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` }
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
