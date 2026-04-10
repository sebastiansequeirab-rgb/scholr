export type Profile = {
  id: string
  full_name: string
  theme: 'indigo' | 'purple' | 'green'
  color_mode: 'light' | 'dark' | 'system'
  language: 'es' | 'en'
  is_premium: boolean
  updated_at: string
}

export type Subject = {
  id: string
  user_id: string
  name: string
  professor: string | null
  color: string
  icon: string | null
  room: string | null
  credits: number | null
  created_at: string
}

export type Schedule = {
  id: string
  user_id: string
  subject_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}

export type Task = {
  id: string
  user_id: string
  subject_id: string | null
  text: string
  priority: 'high' | 'mid' | 'low'
  status: 'not_started' | 'in_progress' | 'done'
  due_date: string | null
  is_done: boolean
  done_at: string | null
  position: number
  notes: string | null
  created_at: string
}

export type Subtask = {
  id: string
  user_id: string
  task_id: string
  text: string
  is_done: boolean
  position: number
}

export type Exam = {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  exam_date: string
  exam_time: string | null
  location: string | null
  notes: string | null
  created_at: string
}

export type Note = {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  content: string
  updated_at: string
  created_at: string
}

export const SUBJECT_COLORS = [
  '#185FA5', '#534AB7', '#0F6E56', '#854F0B',
  '#993556', '#A32D2D', '#0C5A8A', '#3B6D11',
  '#D85A30', '#5F5E5A', '#7F77DD', '#1D9E75',
  '#6B4FA8', '#1A7A6E', '#C25D8A', '#3D7A45',
  '#B06020', '#4A6FA5', '#7A5C3A', '#2D6B8A',
]

export const THEME_COLORS = {
  indigo: { primary: '#185FA5', secondary: '#1D9E75', accent: '#534AB7' },
  purple: { primary: '#534AB7', secondary: '#EF9F27', accent: '#3C3489' },
  green: { primary: '#0F6E56', secondary: '#3B6D11', accent: '#085041' },
}
