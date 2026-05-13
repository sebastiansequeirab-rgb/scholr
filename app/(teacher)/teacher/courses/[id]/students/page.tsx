import { permanentRedirect } from 'next/navigation'

export default function StudentsCourseRedirect({ params }: { params: { id: string } }) {
  permanentRedirect(`/teacher/students?course=${params.id}`)
}
