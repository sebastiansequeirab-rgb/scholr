/**
 * Teacher portal — course statistics derived from raw Supabase rows.
 * All work in JS so we can compose multiple metrics from a single fetch.
 */

export type ExamWithGrades = {
  id: string
  percentage: number | null
  exam_grades: { grade: number | null }[]
}

/** Course-level average (0..20) from teacher-assigned exams + exam_grades.
 *  For each graded exam: avg(grades) × percentage. Then rescale by graded weight. */
export function courseAverage(exams: ExamWithGrades[]): number | null {
  let earnedSoFar = 0
  let gradedWeight = 0
  for (const ex of exams) {
    const pct = ex.percentage ?? 0
    const grades = (ex.exam_grades ?? []).map(g => g.grade).filter((g): g is number => g != null)
    if (pct > 0 && grades.length > 0) {
      const examAvg = grades.reduce((s, g) => s + g, 0) / grades.length
      earnedSoFar  += examAvg * (pct / 100)
      gradedWeight += pct
    }
  }
  if (gradedWeight === 0) return null
  return (earnedSoFar / (gradedWeight / 100))
}

export function passRate(exams: ExamWithGrades[]): number | null {
  let pass = 0, total = 0
  for (const ex of exams) {
    for (const g of ex.exam_grades ?? []) {
      if (g.grade == null) continue
      total++
      if (g.grade >= 9.5) pass++
    }
  }
  return total === 0 ? null : (pass / total) * 100
}

/** Mean of courseAverage across courses (only counts courses with at least 1 graded exam). */
export function overallAverage(courseAvgs: (number | null)[]): number | null {
  const present = courseAvgs.filter((n): n is number => n != null)
  if (present.length === 0) return null
  return present.reduce((s, n) => s + n, 0) / present.length
}

const DAY_LABELS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_LABELS_EN = ['Sunday',  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_LABELS_ES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_LABELS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayLabel(day: number, lang: 'es' | 'en' = 'es', short = false): string {
  const arr = lang === 'es' ? (short ? DAY_LABELS_ES_SHORT : DAY_LABELS_ES) : (short ? DAY_LABELS_EN_SHORT : DAY_LABELS_EN)
  return arr[day] ?? '—'
}

/** Given a list of schedules, return the next N upcoming class slots within the next 7 days. */
export type ScheduleSlot = {
  id: string
  subject_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}

export type UpcomingClass = ScheduleSlot & {
  course_name: string
  course_accent: string | null
  course_icon: string | null
  occurs_on: string
}

export function upcomingClasses(
  schedules: ScheduleSlot[],
  courses: { id: string; name: string; accent: string | null; icon: string | null }[],
  now: Date = new Date(),
  daysAhead = 7,
  limit = 6,
): UpcomingClass[] {
  const byCourse = new Map(courses.map(c => [c.id, c]))
  const result: UpcomingClass[] = []

  for (let i = 0; i < daysAhead; i++) {
    const day = new Date(now)
    day.setDate(day.getDate() + i)
    const dow = day.getDay()
    const slots = schedules.filter(s => s.day_of_week === dow)
    for (const slot of slots) {
      if (i === 0) {
        // Filter out slots that have already ended today
        const [h, m] = slot.end_time.split(':').map(Number)
        const endTotal = h * 60 + m
        const nowTotal = now.getHours() * 60 + now.getMinutes()
        if (endTotal < nowTotal) continue
      }
      const course = byCourse.get(slot.subject_id)
      if (!course) continue
      result.push({
        ...slot,
        course_name: course.name,
        course_accent: course.accent,
        course_icon: course.icon,
        occurs_on: day.toISOString().slice(0, 10),
      })
    }
  }

  result.sort((a, b) => {
    if (a.occurs_on !== b.occurs_on) return a.occurs_on < b.occurs_on ? -1 : 1
    return a.start_time < b.start_time ? -1 : 1
  })

  return result.slice(0, limit)
}
