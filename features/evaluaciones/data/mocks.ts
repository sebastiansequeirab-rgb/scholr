// Hardcoded mock data for /evaluaciones (visual rebuild v2)
// Replaced with Supabase queries (exams + exam_grades overlay) once visual is approved.

export type Urgency = 'today' | 'tomorrow' | 'soon' | 'later'
export type EvalType = 'ENTREGA' | 'QUIZ' | 'EXAMEN' | 'PARCIAL' | 'FINAL'
export type CountdownTone = 'danger' | 'warning' | 'muted'

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
  },
]
