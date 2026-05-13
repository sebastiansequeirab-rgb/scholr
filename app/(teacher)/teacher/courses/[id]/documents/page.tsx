import { permanentRedirect } from 'next/navigation'

export default function DocumentsCourseRedirect({ params }: { params: { id: string } }) {
  permanentRedirect(`/teacher/documents?course=${params.id}`)
}
