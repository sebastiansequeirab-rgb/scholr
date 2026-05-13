import { redirect, permanentRedirect } from 'next/navigation'

export default function TeacherDashboardRedirect() {
  permanentRedirect('/teacher')
  // never reached
  redirect('/teacher')
}
