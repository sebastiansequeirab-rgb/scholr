// ─── Tool definitions + handlers ─────────────────────────────────────────────
// Each tool: an OpenAI-compatible function definition + an execute() that queries Supabase.
// The model never touches the DB directly — it only calls these.

import { createClient } from '@supabase/supabase-js'
import type { ToolDefinition } from '../provider'
import type { ToolResult } from '../types'

// Build an authenticated Supabase client from the user's JWT
function supabaseAs(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
      description: 'Create a general to-do task (NOT for academic assignments, entregas, exams, workshops or graded activities — use create_exam for those). Use only for reminders or personal to-dos without a grade/percentage.',
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
      description: 'Create a graded academic activity that appears in the Planner: exams, assignments, entregas, talleres, workshops, prácticas, or any activity with a percentage/grade. Use activity_type="task" for assignments/entregas/deliveries, "exam" for exams/parciales, "workshop" for talleres/prácticas, "activity" for general graded activities.',
      parameters: {
        type: 'object',
        properties: {
          title:         { type: 'string', description: 'Title of the activity' },
          exam_date:     { type: 'string', description: 'Date YYYY-MM-DD' },
          activity_type: { type: 'string', description: 'exam | workshop | activity | task | study_session. Use "task" for assignments/entregas/deliveries.' },
          subject_id:    { type: 'string', description: 'UUID of related subject. ALWAYS include if the user is chatting in a subject context.' },
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
        // RLS already handles filtering: own exams + enrolled teacher exams
        const { data, error } = await db
          .from('exams')
          .select('id, title, exam_date, exam_time, activity_type, percentage, location, assigned_by, subjects(name)')
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
          .select('id, title, content, updated_at')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .order('updated_at', { ascending: false })
          .limit(10)
        if (error) return { ok: false, error: error.message }
        // Strip Tiptap JSON to plain text for the model
        const notes = (data ?? []).map(n => {
          let plain = n.title || ''
          try {
            const doc = JSON.parse(n.content || '{}')
            const extract = (nodes: { type?: string; text?: string; content?: unknown[] }[]): string =>
              nodes.map(node => node.text ?? (node.content ? extract(node.content as { type?: string; text?: string; content?: unknown[] }[]) : '')).join(' ')
            if (doc.content) plain += '\n' + extract(doc.content)
          } catch { plain += '\n' + (n.content || '') }
          return { id: n.id, title: n.title, updated_at: n.updated_at, text: plain.slice(0, 2000) }
        })
        return { ok: true, data: notes }
      }

      case 'get_subject_progress': {
        const subjectId = String(args.subject_id ?? '')
        if (!subjectId) return { ok: false, error: 'subject_id required' }
        // RLS handles access: own exams + enrolled teacher exams
        const { data, error } = await db
          .from('exams')
          .select('id, title, activity_type, percentage, grade, exam_date, assigned_by')
          .eq('subject_id', subjectId)
          .neq('activity_type', 'study_session')
          .order('exam_date')
        if (error) return { ok: false, error: error.message }
        const exams = data ?? []
        // Fetch teacher grades for teacher-assigned exams
        const teacherExamIds = exams.filter(e => e.assigned_by != null).map(e => e.id as string)
        const teacherGradeMap: Record<string, number | null> = {}
        if (teacherExamIds.length > 0) {
          const { data: grades } = await db
            .from('exam_grades')
            .select('exam_id, grade')
            .eq('student_id', userId)
            .in('exam_id', teacherExamIds)
          for (const g of (grades ?? [])) {
            const eg = g as { exam_id: string; grade: number | null }
            teacherGradeMap[eg.exam_id] = eg.grade
          }
        }
        const examsWithGrades = exams.map(e => ({
          ...e,
          effective_grade: e.assigned_by != null ? (teacherGradeMap[e.id as string] ?? null) : e.grade,
        }))
        const earned  = examsWithGrades.filter(e => e.effective_grade != null).reduce((s, e) => s + (e.effective_grade! * (e.percentage ?? 0) / 100), 0)
        const pending = examsWithGrades.filter(e => e.effective_grade == null).reduce((s, e) => s + (20 * (e.percentage ?? 0) / 100), 0)
        return { ok: true, data: { exams: examsWithGrades, earned: +earned.toFixed(2), max_possible: +(earned + pending).toFixed(2) } }
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

        const subjectId = typeof args.subject_id === 'string' ? args.subject_id : null
        let exam_time: string | null = typeof args.exam_time === 'string' ? args.exam_time : null
        let location: string | null = typeof args.location === 'string' ? args.location : null

        // Autocomplete room + time from subject schedule if not provided
        if (subjectId && (!exam_time || !location)) {
          const [y, m, d] = exam_date.split('-').map(Number)
          const dayOfWeek = new Date(y, m - 1, d).getDay() // 0=Sun..6=Sat
          const { data: schedules } = await db
            .from('schedules')
            .select('start_time, room')
            .eq('subject_id', subjectId)
            .eq('day_of_week', dayOfWeek)
            .order('start_time')
          if (schedules && schedules.length > 0) {
            if (!exam_time) exam_time = schedules[0].start_time?.slice(0, 5) ?? null
            if (!location) location = schedules[0].room ?? null
          }
        }

        const { data, error } = await db
          .from('exams')
          .insert({
            user_id: userId,
            title,
            exam_date,
            activity_type,
            subject_id:  subjectId,
            percentage:  typeof args.percentage === 'number' ? args.percentage : null,
            exam_time,
            location,
          })
          .select('id, title, exam_date, activity_type')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      }

      case 'get_subject_evaluations': {
        const subjectId = String(args.subject_id ?? '')
        if (!subjectId) return { ok: false, error: 'subject_id required' }
        // RLS handles access: own exams + enrolled teacher exams
        const { data, error } = await db
          .from('exams')
          .select('id, title, activity_type, exam_date, exam_time, percentage, grade, submission_status, location, assigned_by')
          .eq('subject_id', subjectId)
          .neq('activity_type', 'study_session')
          .order('exam_date')
        if (error) return { ok: false, error: error.message }
        const exams = data ?? []
        // Fetch teacher grades for teacher-assigned exams
        const teacherExamIds = exams.filter(e => e.assigned_by != null).map(e => e.id as string)
        const teacherGradeMap: Record<string, number | null> = {}
        if (teacherExamIds.length > 0) {
          const { data: grades } = await db
            .from('exam_grades')
            .select('exam_id, grade')
            .eq('student_id', userId)
            .in('exam_id', teacherExamIds)
          for (const g of (grades ?? [])) {
            const eg = g as { exam_id: string; grade: number | null }
            teacherGradeMap[eg.exam_id] = eg.grade
          }
        }
        const examsWithGrades = exams.map(e => ({
          ...e,
          effective_grade: e.assigned_by != null ? (teacherGradeMap[e.id as string] ?? null) : e.grade,
          assigned_by_teacher: e.assigned_by != null,
        }))
        const earned   = examsWithGrades.filter(e => e.effective_grade != null && e.percentage != null).reduce((s, e) => s + (e.effective_grade! * e.percentage! / 100), 0)
        const possible = examsWithGrades.filter(e => e.effective_grade == null && e.percentage != null).reduce((s, e) => s + (20 * e.percentage! / 100), 0)
        return { ok: true, data: { evaluations: examsWithGrades, earned: +earned.toFixed(2), max_possible: +(earned + possible).toFixed(2) } }
      }

      case 'get_all_subjects_summary': {
        const today = new Date().toISOString().split('T')[0]
        // RLS handles both own subjects and enrolled teacher courses
        const [subjectsRes, examsRes, enrollmentsRes] = await Promise.all([
          db.from('subjects').select('id, name, professor, color, credits').order('name'),
          db.from('exams').select('id, subject_id, title, exam_date, percentage, grade, activity_type, assigned_by').neq('activity_type', 'study_session').order('exam_date'),
          db.from('enrollments').select('subject_id').eq('student_id', userId).eq('status', 'active'),
        ])
        if (subjectsRes.error) return { ok: false, error: subjectsRes.error.message }
        const subjects = subjectsRes.data ?? []
        const allExams = examsRes.data ?? []
        const enrolledIds = new Set((enrollmentsRes.data ?? []).map(e => e.subject_id))
        // Fetch teacher grades for teacher-assigned exams
        const teacherExamIds = allExams.filter(e => e.assigned_by != null).map(e => e.id as string)
        const teacherGradeMap: Record<string, number | null> = {}
        if (teacherExamIds.length > 0) {
          const { data: grades } = await db
            .from('exam_grades')
            .select('exam_id, grade')
            .eq('student_id', userId)
            .in('exam_id', teacherExamIds)
          for (const g of (grades ?? [])) {
            const eg = g as { exam_id: string; grade: number | null }
            teacherGradeMap[eg.exam_id] = eg.grade
          }
        }
        const summary = subjects.map(s => {
          const evals = allExams.filter(e => e.subject_id === s.id)
          const graded = evals.filter(e => {
            const g = e.assigned_by != null ? teacherGradeMap[e.id as string] : e.grade
            return g != null && e.percentage != null
          })
          const earned = graded.reduce((sum, e) => {
            const g = e.assigned_by != null ? teacherGradeMap[e.id as string]! : e.grade
            return sum + (g * e.percentage! / 100)
          }, 0)
          const nextEval = evals.find(e => e.exam_date >= today)
          return {
            id: s.id,
            name: s.name,
            professor: s.professor,
            credits: s.credits,
            is_enrolled: enrolledIds.has(s.id),
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
