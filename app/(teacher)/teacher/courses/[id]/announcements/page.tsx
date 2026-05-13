import { permanentRedirect } from 'next/navigation'

export default function AnnouncementsCourseRedirect({ params }: { params: { id: string } }) {
  permanentRedirect(`/teacher/announcements?course=${params.id}`)
}
