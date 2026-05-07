// Hardcoded mock data for /evaluaciones (visual rebuild v2)
// Replaced with Supabase queries (exams + exam_grades overlay) once visual is approved.

export type Urgency = 'today' | 'tomorrow' | 'soon' | 'later'
export type EvalType = 'ENTREGA' | 'QUIZ' | 'EXAMEN' | 'PARCIAL' | 'FINAL'
export type CountdownTone = 'danger' | 'warning' | 'muted'

export interface StudyStep {
  text: string
  done?: boolean
}

export interface MockEval {
  id: string
  day: string                  // "23"
  month: string                // "ABR"
  subKey: 'today' | 'tomorrow' | 'days'   // i18n key path; if 'days' use daysCount
  daysCount?: number
  urgency: Urgency
  subjectCode: 'INST' | 'MATE' | 'TRAD' | 'CALC' | 'TEC'
  subjectColor: string
  type: EvalType
  weight: number               // 15 / 10 / 25 / 30 / 35
  title: string
  time: string                 // "23:59"
  location: string
  prep: number                 // 0–100
  countdown: string            // "4h 34m" / "23h" / "4d" / "13d" / "21d"
  countdownTone: CountdownTone
  estimatedHours: number
  studyPlan: StudyStep[]
}

const COLOR = {
  INST: '#a78bfa',
  MATE: '#34d399',
  CALC: '#fbbf24',
  TEC:  '#22d3ee',
  TRAD: '#fb7185',
} as const

export const MOCK_EVALS: MockEval[] = [
  {
    id: 'e-23-abr',
    day: '23', month: 'ABR',
    subKey: 'today', urgency: 'today',
    subjectCode: 'INST', subjectColor: COLOR.INST,
    type: 'ENTREGA', weight: 15,
    title: 'Entrega Taller — Instalaciones',
    time: '23:59',
    location: 'Campus virtual',
    prep: 35,
    countdown: '4h 34m',
    countdownTone: 'danger',
    estimatedHours: 3,
    studyPlan: [
      { text: 'Cerrar memoria técnica final', done: true },
      { text: 'Exportar planos a PDF (300 dpi)' },
      { text: 'Adjuntar referencias bibliográficas' },
      { text: 'Subir al campus virtual antes de 23:59' },
    ],
  },
  {
    id: 'e-24-abr',
    day: '24', month: 'ABR',
    subKey: 'tomorrow', urgency: 'tomorrow',
    subjectCode: 'MATE', subjectColor: COLOR.MATE,
    type: 'QUIZ', weight: 10,
    title: 'Quiz Cap. 4',
    time: '11:00',
    location: 'A5-22',
    prep: 60,
    countdown: '23h',
    countdownTone: 'muted',
    estimatedHours: 2,
    studyPlan: [
      { text: 'Releer Cap. 4 del libro', done: true },
      { text: 'Resolver ejercicios 4.1 a 4.5', done: true },
      { text: 'Repasar fórmulas clave del capítulo' },
      { text: 'Llegar 15 min antes al A5-22' },
    ],
  },
  {
    id: 'e-27-abr',
    day: '27', month: 'ABR',
    subKey: 'days', daysCount: 4, urgency: 'soon',
    subjectCode: 'TRAD', subjectColor: COLOR.TRAD,
    type: 'EXAMEN', weight: 25,
    title: 'Examen Teórico I',
    time: '09:00',
    location: 'A4-08',
    prep: 40,
    countdown: '4d',
    countdownTone: 'muted',
    estimatedHours: 8,
    studyPlan: [
      { text: 'Estudiar Unidades 1 a 3', done: true },
      { text: 'Hacer resumen propio (10 carillas)' },
      { text: 'Resolver examen modelo' },
      { text: 'Repasar el día anterior' },
      { text: 'Llegar 30 min antes al A4-08' },
    ],
  },
  {
    id: 'e-06-may',
    day: '06', month: 'MAY',
    subKey: 'days', daysCount: 13, urgency: 'later',
    subjectCode: 'CALC', subjectColor: COLOR.CALC,
    type: 'PARCIAL', weight: 30,
    title: 'Parcial Cálculo I',
    time: '14:00',
    location: 'A2-10',
    prep: 20,
    countdown: '13d',
    countdownTone: 'muted',
    estimatedHours: 12,
    studyPlan: [
      { text: 'Releer caps. 5, 6 y 7' },
      { text: 'Hacer 30 ejercicios mixtos' },
      { text: 'Repasar teoremas principales' },
      { text: 'Verificar calculadora permitida' },
      { text: 'Hacer simulacro completo' },
    ],
  },
  {
    id: 'e-14-may',
    day: '14', month: 'MAY',
    subKey: 'days', daysCount: 21, urgency: 'later',
    subjectCode: 'TEC', subjectColor: COLOR.TEC,
    type: 'FINAL', weight: 35,
    title: 'Final Técnicas Manuf.',
    time: '10:00',
    location: 'L1402',
    prep: 5,
    countdown: '21d',
    countdownTone: 'muted',
    estimatedHours: 20,
    studyPlan: [
      { text: 'Armar formulario A4 con todo' },
      { text: 'Estudiar casos prácticos resueltos' },
      { text: 'Repasar todo el semestre por bloques' },
      { text: 'Hacer 2 simulacros con tiempo' },
      { text: 'Estudiar 3+ h/día la última semana' },
    ],
  },
]
