import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { TeacherShell } from '@/features/teacher/layout/TeacherShell'
import { Toaster } from 'sonner'
import type { Profile } from '@/types'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if ((profile as Profile | null)?.role !== 'teacher') {
    redirect('/dashboard')
  }

  const theme = (profile as Profile | null)?.theme || 'indigo'
  const collapsed = cookies().get('teacher_sidebar_collapsed')?.value === '1'

  return (
    <div data-theme={theme}>
      <TeacherShell profile={profile as Profile | null} initialCollapsed={collapsed}>
        {children}
      </TeacherShell>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--s-low)',
            color: 'var(--on-surface)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </div>
  )
}
