import { permanentRedirect } from 'next/navigation'

export default function GradesCourseRedirect({ params }: { params: { id: string } }) {
  permanentRedirect(`/teacher/grades?course=${params.id}`)
}
