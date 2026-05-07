// Hardcoded mock data for /tareas (visual rebuild v2)
// Replaced with Supabase queries once visual is approved.

export type TaskCol = 'pending' | 'doing' | 'done'
export type TaskPriority = 'high' | 'mid' | 'low'

export interface MockTask {
  id: string
  col: TaskCol
  subjectCode: 'INST' | 'MATE' | 'CALC' | 'TEC' | 'PROG' | 'TRAD'
  subjectColor: string         // hex → mapped to tag-* via subjectTag()
  priority: TaskPriority | null
  title: string
  description?: string
  due: string                  // pre-formatted: "Hoy · 23:59" / "Mañana · 14:00" / "Hace 2 días"
  progress?: number            // 0–100, only for col='doing'
  grade?: string               // "17/20", only for col='done' if graded
}

// Subject color anchors that map cleanly through subjectTag():
// INST → purple · MATE → green · CALC → amber · TEC → cyan · PROG → blue · TRAD → rose
const COLOR = {
  INST: '#a78bfa',
  MATE: '#34d399',
  CALC: '#fbbf24',
  TEC:  '#22d3ee',
  PROG: '#60a5fa',
  TRAD: '#fb7185',
} as const

export const MOCK_TASKS: MockTask[] = [
  // ─── Pendientes (4) ───
  {
    id: 't-pend-1',
    col: 'pending',
    subjectCode: 'INST',
    subjectColor: COLOR.INST,
    priority: 'high',
    title: 'Entrega Taller',
    description: 'Memoria técnica + planos en PDF',
    due: 'Hoy · 23:59',
  },
  {
    id: 't-pend-2',
    col: 'pending',
    subjectCode: 'MATE',
    subjectColor: COLOR.MATE,
    priority: 'mid',
    title: 'Estudiar Cap. 4',
    due: 'Mañana · 14:00',
  },
  {
    id: 't-pend-3',
    col: 'pending',
    subjectCode: 'TRAD',
    subjectColor: COLOR.TRAD,
    priority: 'mid',
    title: 'Resumen parcial',
    due: 'Sáb · 18:00',
  },
  {
    id: 't-pend-4',
    col: 'pending',
    subjectCode: 'PROG',
    subjectColor: COLOR.PROG,
    priority: 'low',
    title: 'Leer paper sobre A*',
    due: 'Lun · libre',
  },

  // ─── En curso (2) ───
  {
    id: 't-doing-1',
    col: 'doing',
    subjectCode: 'CALC',
    subjectColor: COLOR.CALC,
    priority: 'mid',
    title: 'Resolver ejercicios cap. 7',
    progress: 65,
    due: 'Mañ · 14:00',
  },
  {
    id: 't-doing-2',
    col: 'doing',
    subjectCode: 'TEC',
    subjectColor: COLOR.TEC,
    priority: 'mid',
    title: 'Informe de laboratorio',
    progress: 40,
    due: 'Mié · 12:00',
  },

  // ─── Hechas (3) ───
  {
    id: 't-done-1',
    col: 'done',
    subjectCode: 'INST',
    subjectColor: COLOR.INST,
    priority: null,
    title: 'Anteproyecto',
    due: 'Hace 2 días',
  },
  {
    id: 't-done-2',
    col: 'done',
    subjectCode: 'MATE',
    subjectColor: COLOR.MATE,
    priority: null,
    title: 'Quiz cap. 3',
    grade: '17/20',
    due: 'Hace 4 días',
  },
  {
    id: 't-done-3',
    col: 'done',
    subjectCode: 'PROG',
    subjectColor: COLOR.PROG,
    priority: null,
    title: 'Lab 1 — Recursión',
    grade: '19/20',
    due: 'Hace 6 días',
  },
]
